"""OCR logic, kept separate from the user interface so it can be tested and reused.

Text recognition uses Tesseract through the `tesserocr` package (the wheel ships
the Tesseract engine itself, so no separate program installation is needed).
By default the classic Tesseract engine is used, which does not rely on neural
networks / deep learning.
"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterator, List, Optional

import pymupdf
import tesserocr
from PIL import Image, ImageOps

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
PDF_EXTENSION = ".pdf"
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | {PDF_EXTENSION}

# Scanned PDF pages are rendered at this resolution before OCR;
# 300 DPI is the resolution Tesseract is tuned for.
PDF_RENDER_DPI = 300

# Images whose shorter side is below this are upscaled, because Tesseract
# recognises small text poorly.
MIN_IMAGE_SIDE_PX = 1000

# Local folder where the user can place extra language files (e.g. tur.traineddata).
LOCAL_TESSDATA_DIR = Path(__file__).resolve().parent / "tessdata"

ENGINE_MODES = {
    "Klasik (derin öğrenmesiz)": tesserocr.OEM.TESSERACT_ONLY,
    "LSTM (sinir ağı)": tesserocr.OEM.LSTM_ONLY,
}
DEFAULT_ENGINE_MODE = "Klasik (derin öğrenmesiz)"

# Called with (current_page, total_pages) so the UI can show progress.
ProgressCallback = Callable[[int, int], None]


class OcrError(Exception):
    """Raised with a user-facing (Turkish) message when OCR cannot run."""


@dataclass
class PageResult:
    page_number: int
    text: str
    used_ocr: bool


def find_tessdata_dir() -> Optional[Path]:
    """Return the first folder that contains Tesseract language files.

    Order: the tool's own `tessdata` folder, the TESSDATA_PREFIX environment
    variable, then the pip-installed `tessdata` package.
    """
    candidates = [LOCAL_TESSDATA_DIR]
    if os.environ.get("TESSDATA_PREFIX"):
        candidates.append(Path(os.environ["TESSDATA_PREFIX"]))
    try:
        import tessdata  # optional: installed via `pip install tessdata.eng`

        # The local `tessdata` folder can shadow the pip package as a namespace
        # package, so only use it when it really is the package.
        if hasattr(tessdata, "data_path"):
            candidates.append(Path(tessdata.data_path()))
    except ImportError:
        pass

    for folder in candidates:
        if folder.is_dir() and any(folder.glob("*.traineddata")):
            return folder
    return None


def available_languages(tessdata_dir: Path) -> List[str]:
    """List language codes (e.g. 'tur', 'eng'), excluding the orientation model."""
    return sorted(p.stem for p in tessdata_dir.glob("*.traineddata") if p.stem != "osd")


def prepare_image(image: Image.Image) -> Image.Image:
    """Grayscale + upscale small images; both noticeably improve classic OCR accuracy."""
    image = ImageOps.exif_transpose(image).convert("L")
    shorter_side = min(image.size)
    if shorter_side < MIN_IMAGE_SIDE_PX:
        scale = MIN_IMAGE_SIDE_PX / shorter_side
        new_size = (round(image.width * scale), round(image.height * scale))
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    return image


class OcrEngine:
    """Wraps one Tesseract instance; reuse it for all pages of a document."""

    def __init__(self, tessdata_dir: Path, language: str, engine_mode: str = DEFAULT_ENGINE_MODE):
        try:
            self._api = tesserocr.PyTessBaseAPI(
                path=str(tessdata_dir), lang=language, oem=ENGINE_MODES[engine_mode]
            )
        except RuntimeError as exc:
            raise OcrError(
                f"'{language}' dil dosyası bu motor modu ile yüklenemedi. "
                "Klasik mod için 'tessdata' (fast olmayan) dil dosyası gerekir."
            ) from exc

    def close(self) -> None:
        self._api.End()

    def __enter__(self) -> "OcrEngine":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()

    def read_image(self, image: Image.Image) -> str:
        self._api.SetImage(prepare_image(image))
        return self._api.GetUTF8Text().strip()

    def read_file(self, file_path: Path, on_progress: Optional[ProgressCallback] = None) -> List[PageResult]:
        extension = file_path.suffix.lower()
        if extension in IMAGE_EXTENSIONS:
            with Image.open(file_path) as image:
                text = self.read_image(image)
            if on_progress:
                on_progress(1, 1)
            return [PageResult(page_number=1, text=text, used_ocr=True)]
        if extension == PDF_EXTENSION:
            return list(self._read_pdf(file_path, on_progress))
        raise OcrError(f"Desteklenmeyen dosya türü: {extension}")

    def _read_pdf(self, file_path: Path, on_progress: Optional[ProgressCallback]) -> Iterator[PageResult]:
        with pymupdf.open(file_path) as document:
            total = document.page_count
            for index, page in enumerate(document, start=1):
                yield self._read_pdf_page(page, index)
                if on_progress:
                    on_progress(index, total)

    def _read_pdf_page(self, page: pymupdf.Page, page_number: int) -> PageResult:
        # Pages that already contain selectable text do not need OCR;
        # reading it directly is faster and exact.
        embedded_text = page.get_text().strip()
        if embedded_text:
            return PageResult(page_number=page_number, text=embedded_text, used_ocr=False)

        pixmap = page.get_pixmap(dpi=PDF_RENDER_DPI, colorspace=pymupdf.csGRAY)
        image = Image.frombytes("L", (pixmap.width, pixmap.height), pixmap.samples)
        return PageResult(page_number=page_number, text=self.read_image(image), used_ocr=True)


def format_results(results: List[PageResult]) -> str:
    """Join page texts; page headers are added only for multi-page documents."""
    if len(results) == 1:
        return results[0].text
    parts = []
    for result in results:
        source = "OCR" if result.used_ocr else "PDF metni"
        parts.append(f"===== Sayfa {result.page_number} ({source}) =====\n{result.text}")
    return "\n\n".join(parts)
