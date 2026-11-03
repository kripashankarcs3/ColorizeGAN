"""Command-line entry point for ReMemory AI."""

import argparse

from app.colorize import colorize


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Colorize a grayscale photograph with the ReMemory AI GAN."
    )
    parser.add_argument("image", help="Path to a PNG, JPG, or JPEG image")
    parser.add_argument(
        "--output", help="Optional output path (PNG is recommended)", default=None
    )
    args = parser.parse_args()

    output = colorize(args.image, args.output)
    print(f"Colorized image saved to: {output}")


if __name__ == "__main__":
    main()
