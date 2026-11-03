from PIL import Image
from sklearn.model_selection import train_test_split
import tensorflow as tf
import numpy as np
import os
from pathlib import Path
from tensorflow.keras.losses import BinaryCrossentropy, MeanSquaredError

from app.archs.generator import get_generator_model
from app.archs.discriminator import get_discriminator_model

PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
batch_size = 5
img_size = 120
dataset_split = 2500


def main():
    gpus = tf.config.list_physical_devices('GPU')
    print(gpus)

    master_dir = PROJECT_ROOT / "dataset" / "train" / "color"
    if not master_dir.is_dir():
        raise FileNotFoundError(
            f"Training data is missing: {master_dir}. "
            "Run `python download_dataset.py` first."
        )
    image_files = [
        f for f in sorted(os.listdir(master_dir))
        if os.path.splitext(f)[1].lower() in IMAGE_EXTENSIONS
    ]
    x = []
    y = []
    for image_file in image_files[0: dataset_split]:
        rgb_image = Image.open(os.path.join(master_dir, image_file)).convert("RGB").resize((img_size, img_size))
        # Normalize the RGB image array
        rgb_image_array = (np.asarray(rgb_image)) / 255
        grey_image = rgb_image.convert('L')
        # Normalize the Grey scale image array
        grey_image_array = (np.asarray(grey_image).reshape((img_size, img_size, 1))) / 255
        x.append(grey_image_array)
        y.append(rgb_image_array)

    # train test splitting
    train_x, test_x, train_y, test_y = train_test_split(np.array(x), np.array(y), test_size=0.1)

    # Construct tf.data.Dataset object
    dataset = tf.data.Dataset.from_tensor_slices((train_x, train_y))
    dataset = dataset.batch(batch_size)

    # Loss function
    cross_entropy = BinaryCrossentropy()
    mse = MeanSquaredError()

    def discriminator_loss(real_output, fake_output):
        real_loss = cross_entropy(tf.ones_like(real_output) - tf.random.uniform(shape=real_output.shape, maxval=0.1),
                                  real_output)
        fake_loss = cross_entropy(tf.zeros_like(fake_output) + tf.random.uniform(shape=fake_output.shape, maxval=0.1),
                                  fake_output)
        total_loss = real_loss + fake_loss
        return total_loss

    def generator_loss(fake_output, real_y):
        real_y = tf.cast(real_y, 'float32')
        return mse(fake_output, real_y)

    generator_optimizer = tf.keras.optimizers.Adam(0.0005)
    discriminator_optimizer = tf.keras.optimizers.Adam(0.0005)

    generator = get_generator_model(img_size)
    discriminator = get_discriminator_model(img_size)

    @tf.function
    def train_step(input_x, real_y):
        with tf.GradientTape() as gen_tape, tf.GradientTape() as disc_tape:
            # Generate an image -> G(x)
            generated_images = generator(input_x, training=True)
            # Probability that the given image is real -> D( x )
            real_output = discriminator(real_y, training=True)
            # Probability that the given image is the one generated -> D( G( x ) )
            generated_output = discriminator(generated_images, training=True)

            # L2 Loss -> ||y-G(x)||^2
            gen_loss = generator_loss(generated_images, real_y)
            # Log loss for the discriminator
            disc_loss = discriminator_loss(real_output, generated_output)

            # Compute the gradients
            gradients_of_generator = gen_tape.gradient(gen_loss, generator.trainable_variables)
            gradients_of_discriminator = disc_tape.gradient(disc_loss, discriminator.trainable_variables)

            # Optimize with Adam
            generator_optimizer.apply_gradients(zip(gradients_of_generator, generator.trainable_variables))
            discriminator_optimizer.apply_gradients(zip(gradients_of_discriminator, discriminator.trainable_variables))

    # Create a directory to save the model checkpoints
    checkpoint_dir = PROJECT_ROOT / "app" / "checkpoints"
    os.makedirs(checkpoint_dir, exist_ok=True)
    checkpoint_path = checkpoint_dir / "model_checkpoint.h5"
    num_epochs = 200

    for e in range(num_epochs):
        for (x_component, y_component) in dataset:
            # Here ( x , y ) represents a batch from our training dataset.
            print("(epoch no: ", e, ") ", x_component.shape, " ", y_component.shape)
            train_step(x_component, y_component)
        # Save the model after each epoch
        generator.save_weights(checkpoint_path)

    # Final save of the model
    model_dir = PROJECT_ROOT / "app" / "model"
    os.makedirs(model_dir, exist_ok=True)
    generator.save(model_dir / "CCGAN_Model.h5")


if __name__ == "__main__":
    main()
