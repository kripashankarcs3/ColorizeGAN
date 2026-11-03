"""Premium ReMemory AI desktop studio."""

from pathlib import Path
import sys
import time
from typing import Optional

from PIL import Image
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import QFont, QIcon, QPixmap
from PyQt5.QtWidgets import (
    QApplication,
    QFileDialog,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from app.colorize import PROJECT_ROOT, colorize


ASSET_ROOT = PROJECT_ROOT / "app" / "ui" / "assets"
SAMPLE_ROOT = PROJECT_ROOT / "app" / "test"
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
SUPPORTED_FILTER = "Photographs (*.png *.jpg *.jpeg)"


class ColorizeWorker(QThread):
    completed = pyqtSignal(str, float)
    failed = pyqtSignal(str)

    def __init__(self, source: Path):
        super().__init__()
        self.source = source

    def run(self) -> None:
        started = time.perf_counter()
        try:
            output = colorize(self.source)
            self.completed.emit(str(output), time.perf_counter() - started)
        except (FileNotFoundError, RuntimeError, ValueError, OSError) as exc:
            self.failed.emit(str(exc))


class DropLabel(QLabel):
    file_dropped = pyqtSignal(str)

    def __init__(self):
        super().__init__()
        self.setAcceptDrops(True)
        self.setAlignment(Qt.AlignCenter)
        self.setObjectName("dropPreview")

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event):
        for url in event.mimeData().urls():
            if url.isLocalFile():
                self.file_dropped.emit(url.toLocalFile())
                break


class DropFrame(QFrame):
    file_dropped = pyqtSignal(str)

    def __init__(self):
        super().__init__()
        self.setAcceptDrops(True)

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event):
        for url in event.mimeData().urls():
            if url.isLocalFile():
                self.file_dropped.emit(url.toLocalFile())
                break


class MainWindow(QMainWindow):
    """Main window containing the four ReMemory AI studio surfaces."""

    def __init__(self):
        super().__init__()
        self.source_path: Optional[Path] = None
        self.output_path: Optional[Path] = None
        self.worker: Optional[ColorizeWorker] = None
        self.nav_buttons = []
        self.setWindowTitle("ReMemory AI | AI Photo Restoration Studio")
        self.setWindowIcon(QIcon(str(ASSET_ROOT / "icon.ico")))
        self.setMinimumSize(980, 680)
        self.resize(1240, 820)

        self.pages = QStackedWidget()
        self.pages.addWidget(self._home_page())
        self.pages.addWidget(self._colorize_page())
        self.pages.addWidget(self._gallery_page())
        self.pages.addWidget(self._about_page())
        self.setCentralWidget(self._layout_with_navigation())
        self._select_page(0)

    def _layout_with_navigation(self) -> QWidget:
        root = QWidget()
        root.setObjectName("appRoot")
        layout = QVBoxLayout(root)
        layout.setContentsMargins(28, 20, 28, 18)
        layout.setSpacing(18)

        header = QFrame()
        header.setObjectName("header")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(18, 12, 18, 12)

        logo = QLabel("R")
        logo.setObjectName("logoMark")
        logo.setAlignment(Qt.AlignCenter)
        logo.setFixedSize(38, 38)
        header_layout.addWidget(logo)

        brand_layout = QVBoxLayout()
        brand_layout.setSpacing(0)
        brand = QLabel("ReMemory AI")
        brand.setObjectName("brand")
        brand_layout.addWidget(brand)
        tagline = QLabel("AI Photo Restoration Studio")
        tagline.setObjectName("brandSubtitle")
        brand_layout.addWidget(tagline)
        header_layout.addLayout(brand_layout)
        header_layout.addStretch()

        for label, page in (
            ("Home", 0),
            ("Colorize", 1),
            ("Gallery", 2),
            ("About", 3),
        ):
            button = QPushButton(label)
            button.setCheckable(True)
            button.setObjectName("navButton")
            button.clicked.connect(lambda _, index=page: self._select_page(index))
            self.nav_buttons.append(button)
            header_layout.addWidget(button)
        layout.addWidget(header)
        layout.addWidget(self.pages, 1)

        footer = QLabel("ReMemory AI  /  GAN-powered restoration  /  CPU compatible")
        footer.setObjectName("footer")
        layout.addWidget(footer)
        return root

    def _select_page(self, index: int) -> None:
        self.pages.setCurrentIndex(index)
        for page, button in enumerate(self.nav_buttons):
            button.setChecked(page == index)

    @staticmethod
    def _scroll_page(content: QWidget) -> QScrollArea:
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setWidget(content)
        return scroll

    @staticmethod
    def _section_heading(title: str, subtitle: str) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 8)
        layout.setSpacing(7)
        title_label = QLabel(title)
        title_label.setObjectName("pageTitle")
        layout.addWidget(title_label)
        subtitle_label = QLabel(subtitle)
        subtitle_label.setObjectName("pageSubtitle")
        subtitle_label.setWordWrap(True)
        layout.addWidget(subtitle_label)
        return widget

    @staticmethod
    def _button(text: str, object_name: str = "secondaryButton") -> QPushButton:
        button = QPushButton(text)
        button.setObjectName(object_name)
        button.setCursor(Qt.PointingHandCursor)
        return button

    @staticmethod
    def _feature_card(title: str, description: str, accent: str) -> QFrame:
        card = QFrame()
        card.setObjectName("featureCard")
        layout = QVBoxLayout(card)
        icon = QLabel(accent)
        icon.setObjectName("featureIcon")
        layout.addWidget(icon)
        title_label = QLabel(title)
        title_label.setObjectName("cardTitle")
        layout.addWidget(title_label)
        description_label = QLabel(description)
        description_label.setObjectName("cardBody")
        description_label.setWordWrap(True)
        layout.addWidget(description_label)
        return card

    def _home_page(self) -> QWidget:
        content = QWidget()
        layout = QVBoxLayout(content)
        layout.setContentsMargins(34, 30, 34, 34)
        layout.setSpacing(24)
        layout.addWidget(
            self._section_heading(
                "Bring Your Memories Back to Life",
                "Transform black-and-white photographs into vibrant color memories using "
                "Generative Adversarial Networks.",
            )
        )

        actions = QHBoxLayout()
        start = self._button("Start Colorizing  >", "primaryButton")
        start.clicked.connect(lambda: self._select_page(1))
        actions.addWidget(start)
        gallery = self._button("Explore Gallery", "secondaryButton")
        gallery.clicked.connect(lambda: self._select_page(2))
        actions.addWidget(gallery)
        actions.addStretch()
        layout.addLayout(actions)

        showcase = QFrame()
        showcase.setObjectName("showcaseCard")
        showcase_layout = QHBoxLayout(showcase)
        showcase_layout.setContentsMargins(22, 22, 22, 22)
        showcase_layout.setSpacing(22)
        for path, label in (
            (ASSET_ROOT / "image_dummies" / "grey_dummy.png", "ORIGINAL"),
            (ASSET_ROOT / "image_dummies" / "color_dummy.png", "STUDIO PREVIEW"),
        ):
            preview = QVBoxLayout()
            caption = QLabel(label)
            caption.setObjectName("eyebrow")
            preview.addWidget(caption)
            image = QLabel()
            image.setAlignment(Qt.AlignCenter)
            image.setPixmap(self._pixmap(path, 390, 230))
            image.setMinimumHeight(230)
            preview.addWidget(image)
            showcase_layout.addLayout(preview, 1)
        layout.addWidget(showcase)

        features = QGridLayout()
        features.setHorizontalSpacing(16)
        features.setVerticalSpacing(16)
        cards = (
            ("GAN-Powered Colorization", "A trained generator creates a plausible RGB interpretation from grayscale input.", "01"),
            ("Intelligent Color Generation", "Learned visual features guide natural color placement while preserving structure.", "02"),
            ("Instant Photo Restoration", "A focused desktop workflow turns a selected photograph into a downloadable result.", "03"),
        )
        for column, card_data in enumerate(cards):
            features.addWidget(self._feature_card(*card_data), 0, column)
        layout.addLayout(features)
        layout.addStretch()
        return self._scroll_page(content)

    def _colorize_page(self) -> QWidget:
        content = QWidget()
        layout = QVBoxLayout(content)
        layout.setContentsMargins(34, 30, 34, 34)
        layout.setSpacing(18)
        layout.addWidget(
            self._section_heading(
                "Restore Your Memories",
                "Upload an old photograph and let AI bring it back to life.",
            )
        )

        upload = DropFrame()
        upload.setObjectName("uploadCard")
        upload_layout = QHBoxLayout(upload)
        upload_layout.setContentsMargins(22, 18, 22, 18)
        upload_icon = QLabel("+")
        upload_icon.setObjectName("uploadIcon")
        upload_icon.setAlignment(Qt.AlignCenter)
        upload_icon.setFixedSize(50, 50)
        upload_layout.addWidget(upload_icon)
        instructions = QVBoxLayout()
        upload_title = QLabel("Drop a photograph here")
        upload_title.setObjectName("cardTitle")
        instructions.addWidget(upload_title)
        upload_hint = QLabel("PNG, JPG, or JPEG  /  Original proportions preserved")
        upload_hint.setObjectName("cardBody")
        instructions.addWidget(upload_hint)
        upload_layout.addLayout(instructions, 1)
        choose = self._button("Choose Photograph", "primaryButton")
        choose.clicked.connect(self._choose_image)
        upload_layout.addWidget(choose)
        upload.file_dropped.connect(self._set_source)
        layout.addWidget(upload)

        previews = QHBoxLayout()
        previews.setSpacing(16)
        self.original_card, self.original_preview = self._preview_card("Original Photograph")
        self.colorized_card, self.colorized_preview = self._preview_card("AI Colorized Result")
        self.original_preview.file_dropped.connect(self._set_source)
        previews.addWidget(self.original_card, 1)
        previews.addWidget(self.colorized_card, 1)
        layout.addLayout(previews)

        actions = QHBoxLayout()
        self.colorize_button = self._button("Colorize Image  >", "gradientButton")
        self.colorize_button.clicked.connect(self._run_colorization)
        actions.addWidget(self.colorize_button)
        clear = self._button("Clear Workspace", "secondaryButton")
        clear.clicked.connect(self._clear)
        actions.addWidget(clear)
        self.download_button = self._button("Download Colorized Image", "secondaryButton")
        self.download_button.setEnabled(False)
        self.download_button.clicked.connect(self._download)
        actions.addWidget(self.download_button)
        actions.addStretch()
        layout.addLayout(actions)

        status_row = QHBoxLayout()
        self.spinner = QProgressBar()
        self.spinner.setRange(0, 0)
        self.spinner.setFixedWidth(150)
        self.spinner.setVisible(False)
        status_row.addWidget(self.spinner)
        self.status = QLabel("Ready for a photograph")
        self.status.setObjectName("status")
        status_row.addWidget(self.status)
        status_row.addStretch()
        layout.addLayout(status_row)
        layout.addStretch()
        return self._scroll_page(content)

    def _preview_card(self, title: str):
        card = QFrame()
        card.setObjectName("previewCard")
        layout = QVBoxLayout(card)
        layout.setContentsMargins(16, 14, 16, 14)
        heading = QHBoxLayout()
        label = QLabel(title)
        label.setObjectName("cardTitle")
        heading.addWidget(label)
        heading.addStretch()
        state = QLabel("WAITING")
        state.setObjectName("stateLabel")
        heading.addWidget(state)
        layout.addLayout(heading)
        preview = DropLabel()
        preview.setMinimumHeight(280)
        preview.setText("Drop your image here" if "Original" in title else "AI result will appear here")
        layout.addWidget(preview, 1)
        metadata = QLabel("No image selected")
        metadata.setObjectName("metadata")
        layout.addWidget(metadata)
        card.metadata = metadata
        card.state_label = state
        return card, preview

    def _gallery_page(self) -> QWidget:
        content = QWidget()
        layout = QVBoxLayout(content)
        layout.setContentsMargins(34, 30, 34, 34)
        layout.setSpacing(20)
        layout.addWidget(
            self._section_heading(
                "Sample Gallery",
                "Explore the same real GAN inference pipeline using photographs bundled with the project.",
            )
        )
        grid = QGridLayout()
        grid.setHorizontalSpacing(16)
        grid.setVerticalSpacing(16)
        samples = (
            ("Vintage Portraits", "Dog_GL.jpg"),
            ("Historical Architecture", "building_GL.jpg"),
        )
        for index, (category, filename) in enumerate(samples):
            grid.addWidget(self._sample_card(category, filename), 0, index)
        for index, category in enumerate(("Family Photographs", "Nature and Landscapes")):
            grid.addWidget(self._empty_sample_card(category), 1, index)
        layout.addLayout(grid)
        layout.addStretch()
        return self._scroll_page(content)

    def _sample_card(self, category: str, filename: str) -> QFrame:
        card = QFrame()
        card.setObjectName("sampleCard")
        layout = QVBoxLayout(card)
        image = QLabel()
        image.setAlignment(Qt.AlignCenter)
        image.setPixmap(self._pixmap(SAMPLE_ROOT / filename, 360, 190))
        layout.addWidget(image)
        category_label = QLabel(category.upper())
        category_label.setObjectName("eyebrow")
        layout.addWidget(category_label)
        name = QLabel(filename)
        name.setObjectName("cardTitle")
        layout.addWidget(name)
        button = self._button("Colorize Sample", "secondaryButton")
        button.clicked.connect(
            lambda checked=False: self._colorize_sample(SAMPLE_ROOT / filename)
        )
        layout.addWidget(button)
        return card

    def _empty_sample_card(self, category: str) -> QFrame:
        card = QFrame()
        card.setObjectName("sampleCard emptyCard")
        layout = QVBoxLayout(card)
        layout.setAlignment(Qt.AlignCenter)
        icon = QLabel("--")
        icon.setObjectName("emptyIcon")
        icon.setAlignment(Qt.AlignCenter)
        layout.addWidget(icon)
        label = QLabel(category.upper())
        label.setObjectName("eyebrow")
        label.setAlignment(Qt.AlignCenter)
        layout.addWidget(label)
        message = QLabel("Add a licensed sample to this category")
        message.setObjectName("cardBody")
        message.setAlignment(Qt.AlignCenter)
        message.setWordWrap(True)
        layout.addWidget(message)
        return card

    def _about_page(self) -> QWidget:
        content = QWidget()
        layout = QVBoxLayout(content)
        layout.setContentsMargins(34, 30, 34, 34)
        layout.setSpacing(18)
        layout.addWidget(
            self._section_heading(
                "About ReMemory AI",
                "A transparent, compact GAN workflow for restoring the feeling in old photographs.",
            )
        )
        overview = QFrame()
        overview.setObjectName("aboutCard")
        overview_layout = QVBoxLayout(overview)
        overview_layout.addWidget(QLabel("THE STUDIO", objectName="eyebrow"))
        body = QLabel(
            "ReMemory AI converts a grayscale photograph into a plausible RGB image "
            "with the bundled trained generator. It preserves the original architecture: "
            "the generator learns color mappings, while the discriminator learns to "
            "distinguish real RGB images from generated ones during training."
        )
        body.setObjectName("cardBody")
        body.setWordWrap(True)
        overview_layout.addWidget(body)
        layout.addWidget(overview)

        cards = QGridLayout()
        cards.setHorizontalSpacing(16)
        cards.setVerticalSpacing(16)
        cards.addWidget(self._technical_card("Generator", "120x120x1 input -> convolutional blocks -> skip connections -> transposed convolutions -> 120x120x3 RGB output."), 0, 0)
        cards.addWidget(self._technical_card("Discriminator", "Convolution and pooling blocks classify real versus generated 120x120 RGB images with a sigmoid output."), 0, 1)
        cards.addWidget(self._technical_card("Training workflow", "Paired RGB images are converted to grayscale. MSE guides the generator and binary cross-entropy trains the discriminator with Adam."), 1, 0)
        cards.addWidget(self._technical_card("Limitations", "Generated colors are plausible, not historical truth. The compact model uses fixed 120-pixel inference and may miss fine detail."), 1, 1)
        layout.addLayout(cards)
        tech = QLabel("Python  /  TensorFlow & Keras  /  PyQt5  /  Pillow  /  NumPy")
        tech.setObjectName("technologyLine")
        layout.addWidget(tech)
        layout.addStretch()
        return self._scroll_page(content)

    @staticmethod
    def _technical_card(title: str, body: str) -> QFrame:
        card = QFrame()
        card.setObjectName("technicalCard")
        layout = QVBoxLayout(card)
        title_label = QLabel(title)
        title_label.setObjectName("cardTitle")
        layout.addWidget(title_label)
        body_label = QLabel(body)
        body_label.setObjectName("cardBody")
        body_label.setWordWrap(True)
        layout.addWidget(body_label)
        return card

    @staticmethod
    def _pixmap(path: Path, width: int, height: int) -> QPixmap:
        return QPixmap(str(path)).scaled(width, height, Qt.KeepAspectRatio, Qt.SmoothTransformation)

    def _choose_image(self) -> None:
        filename, _ = QFileDialog.getOpenFileName(self, "Choose a photograph", "", SUPPORTED_FILTER)
        if filename:
            self._set_source(filename)

    def _colorize_sample(self, path: Path) -> None:
        self._select_page(1)
        self._set_source(str(path))
        self._run_colorization()

    def _set_source(self, filename: str) -> None:
        path = Path(filename)
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            QMessageBox.warning(self, "Unsupported file", "Choose a PNG, JPG, or JPEG photograph.")
            return
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                dimensions = image.size
        except (OSError, ValueError):
            QMessageBox.warning(self, "Invalid image", "The selected file is not a readable image.")
            return
        self.source_path = path
        self.output_path = None
        self.original_preview.setPixmap(self._pixmap(path, 520, 360))
        self.original_preview.setText("")
        self.original_card.metadata.setText(f"{path.name}  /  {dimensions[0]} x {dimensions[1]} px")
        self.original_card.state_label.setText("LOADED")
        self.colorized_preview.clear()
        self.colorized_preview.setText("Ready to colorize")
        self.colorized_card.metadata.setText("Waiting for generator inference")
        self.colorized_card.state_label.setText("WAITING")
        self.download_button.setEnabled(False)
        self.status.setText(f"Selected {path.name}")

    def _run_colorization(self) -> None:
        if self.source_path is None:
            QMessageBox.information(self, "Choose a photograph", "Select or drop a photograph first.")
            return
        if self.worker and self.worker.isRunning():
            return
        self.colorize_button.setEnabled(False)
        self.download_button.setEnabled(False)
        self.spinner.setVisible(True)
        self.colorized_card.state_label.setText("PROCESSING")
        self.status.setText("Running generator inference...")
        self.worker = ColorizeWorker(self.source_path)
        self.worker.completed.connect(self._colorization_completed)
        self.worker.failed.connect(self._colorization_failed)
        self.worker.start()

    def _colorization_completed(self, filename: str, duration: float) -> None:
        self.output_path = Path(filename)
        with Image.open(self.output_path) as image:
            dimensions = image.size
        self.colorized_preview.setPixmap(self._pixmap(self.output_path, 520, 360))
        self.colorized_preview.setText("")
        self.colorized_card.metadata.setText(f"{dimensions[0]} x {dimensions[1]} px  /  RGB")
        self.colorized_card.state_label.setText("COMPLETE")
        self.download_button.setEnabled(True)
        self.colorize_button.setEnabled(True)
        self.spinner.setVisible(False)
        self.status.setText(f"Colorization complete in {duration:.2f} seconds")

    def _colorization_failed(self, message: str) -> None:
        self.colorize_button.setEnabled(True)
        self.spinner.setVisible(False)
        self.colorized_card.state_label.setText("ERROR")
        self.status.setText("Colorization failed")
        QMessageBox.critical(self, "Colorization error", message)

    def _clear(self) -> None:
        self.source_path = None
        self.output_path = None
        self.original_preview.clear()
        self.original_preview.setText("Drop your image here")
        self.original_card.metadata.setText("No image selected")
        self.original_card.state_label.setText("WAITING")
        self.colorized_preview.clear()
        self.colorized_preview.setText("AI result will appear here")
        self.colorized_card.metadata.setText("No image selected")
        self.colorized_card.state_label.setText("WAITING")
        self.download_button.setEnabled(False)
        self.status.setText("Ready for a photograph")

    def _download(self) -> None:
        if self.output_path is None:
            return
        filename, _ = QFileDialog.getSaveFileName(
            self, "Save colorized image", self.output_path.name, "PNG image (*.png)"
        )
        if filename:
            try:
                destination = Path(filename)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(self.output_path.read_bytes())
            except OSError as exc:
                QMessageBox.critical(self, "Save error", str(exc))
            else:
                self.status.setText(f"Saved colorized image to {filename}")
                QMessageBox.information(self, "Download complete", "Your colorized image was saved successfully.")


def main() -> None:
    app = QApplication(sys.argv)
    app.setStyleSheet((PROJECT_ROOT / "app" / "ui" / "Styles" / "style.qss").read_text())
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
