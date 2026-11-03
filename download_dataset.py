from datasets import load_dataset
from pathlib import Path
from PIL import Image
from tqdm import tqdm

DATASET = "ayushshah/coco-2017-image-colorization-224"
OUTPUT = Path("dataset")
TRAIN_LIMIT = 2000
VAL_LIMIT = 200

def download_split(split, limit):
    data = load_dataset(
        DATASET,
        split=split,
        streaming=True
    )

    color_dir = OUTPUT / split / "color"
    gray_dir = OUTPUT / split / "grayscale"

    color_dir.mkdir(parents=True, exist_ok=True)
    gray_dir.mkdir(parents=True, exist_ok=True)

    for i, item in enumerate(tqdm(data, total=limit, desc=split)):
        if i >= limit:
            break

        image = item["image"].convert("RGB")

        image.save(color_dir / f"{i:05d}.jpg", quality=95)

        grayscale = image.convert("L")
        grayscale.save(gray_dir / f"{i:05d}.jpg")

    print(f"{split}: {min(i + 1, limit)} images saved")


if __name__ == "__main__":
    download_split("train", TRAIN_LIMIT)
    download_split("validation", VAL_LIMIT)

    print("Dataset preparation completed!")