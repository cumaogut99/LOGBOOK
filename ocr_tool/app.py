"""Desktop interface for the OCR tool (tkinter ships with Python, nothing extra to install).

Run with:  python app.py
"""

import queue
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

from ocr_engine import (
    DEFAULT_ENGINE_MODE,
    ENGINE_MODES,
    LOCAL_TESSDATA_DIR,
    OcrEngine,
    OcrError,
    available_languages,
    find_tessdata_dir,
    format_results,
)

WINDOW_TITLE = "Görselden Metin Çıkarma (OCR)"
FILE_TYPES = [
    ("Desteklenen dosyalar", "*.png *.jpg *.jpeg *.pdf"),
    ("Görseller", "*.png *.jpg *.jpeg"),
    ("PDF", "*.pdf"),
]
PREFERRED_LANGUAGES = ("tur", "eng")
QUEUE_POLL_MS = 100


class OcrApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title(WINDOW_TITLE)
        self.root.geometry("900x650")

        self.tessdata_dir = find_tessdata_dir()
        self.languages = available_languages(self.tessdata_dir) if self.tessdata_dir else []
        # Worker thread -> UI messages; tkinter must only be touched from the main thread.
        self.messages: "queue.Queue[tuple]" = queue.Queue()

        self.language_var = tk.StringVar(value=self._default_language())
        self.engine_var = tk.StringVar(value=DEFAULT_ENGINE_MODE)
        self.status_var = tk.StringVar(value=self._initial_status())

        self._build_toolbar()
        self._build_text_area()
        self._build_status_bar()

    # ---------- layout ----------

    def _build_toolbar(self) -> None:
        bar = ttk.Frame(self.root, padding=8)
        bar.pack(fill=tk.X)

        self.select_button = ttk.Button(bar, text="Dosya Seç ve Oku", command=self.on_select_file)
        self.select_button.pack(side=tk.LEFT)

        ttk.Label(bar, text="Dil:").pack(side=tk.LEFT, padx=(16, 4))
        ttk.Combobox(
            bar, textvariable=self.language_var, values=self.languages, width=8, state="readonly"
        ).pack(side=tk.LEFT)

        ttk.Label(bar, text="Motor:").pack(side=tk.LEFT, padx=(16, 4))
        ttk.Combobox(
            bar, textvariable=self.engine_var, values=list(ENGINE_MODES), width=26, state="readonly"
        ).pack(side=tk.LEFT)

        ttk.Button(bar, text="Metni Kaydet", command=self.on_save_text).pack(side=tk.RIGHT)
        ttk.Button(bar, text="Kopyala", command=self.on_copy_text).pack(side=tk.RIGHT, padx=4)

        if not self.languages:
            self.select_button.state(["disabled"])

    def _build_text_area(self) -> None:
        self.text_area = ScrolledText(self.root, wrap=tk.WORD, font=("Consolas", 11))
        self.text_area.pack(fill=tk.BOTH, expand=True, padx=8)

    def _build_status_bar(self) -> None:
        bar = ttk.Frame(self.root, padding=8)
        bar.pack(fill=tk.X)
        self.progress = ttk.Progressbar(bar, length=200, mode="determinate")
        self.progress.pack(side=tk.RIGHT)
        ttk.Label(bar, textvariable=self.status_var).pack(side=tk.LEFT)

    def _default_language(self) -> str:
        for code in PREFERRED_LANGUAGES:
            if code in self.languages:
                return code
        return self.languages[0] if self.languages else ""

    def _initial_status(self) -> str:
        if not self.languages:
            return f"Dil dosyası bulunamadı. '{LOCAL_TESSDATA_DIR}' klasörüne .traineddata dosyası ekleyin."
        return f"Hazır. Dil dosyaları: {self.tessdata_dir}"

    # ---------- actions ----------

    def on_select_file(self) -> None:
        file_name = filedialog.askopenfilename(title="Dosya seçin", filetypes=FILE_TYPES)
        if not file_name:
            return
        self.select_button.state(["disabled"])
        self.progress["value"] = 0
        self.status_var.set(f"Okunuyor: {Path(file_name).name}")
        self.text_area.delete("1.0", tk.END)

        worker = threading.Thread(
            target=self._run_ocr,
            args=(Path(file_name), self.language_var.get(), self.engine_var.get()),
            daemon=True,
        )
        worker.start()
        self.root.after(QUEUE_POLL_MS, self._process_messages)

    def on_copy_text(self) -> None:
        self.root.clipboard_clear()
        self.root.clipboard_append(self.text_area.get("1.0", tk.END).strip())
        self.status_var.set("Metin panoya kopyalandı.")

    def on_save_text(self) -> None:
        file_name = filedialog.asksaveasfilename(
            defaultextension=".txt", filetypes=[("Metin dosyası", "*.txt")]
        )
        if file_name:
            Path(file_name).write_text(self.text_area.get("1.0", tk.END), encoding="utf-8")
            self.status_var.set(f"Kaydedildi: {file_name}")

    # ---------- background work ----------

    def _run_ocr(self, file_path: Path, language: str, engine_mode: str) -> None:
        """Runs in a worker thread so the window stays responsive on long PDFs."""
        try:
            with OcrEngine(self.tessdata_dir, language, engine_mode) as engine:
                results = engine.read_file(
                    file_path, on_progress=lambda done, total: self.messages.put(("progress", done, total))
                )
            self.messages.put(("done", format_results(results), file_path.name))
        except OcrError as exc:
            self.messages.put(("error", str(exc)))
        except Exception as exc:  # show any unexpected failure instead of a silent crash
            self.messages.put(("error", f"Beklenmeyen hata: {exc}"))

    def _process_messages(self) -> None:
        finished = False
        while not self.messages.empty():
            kind, *payload = self.messages.get()
            if kind == "progress":
                done, total = payload
                self.progress["value"] = done / total * 100
                self.status_var.set(f"Sayfa {done}/{total} okundu...")
            elif kind == "done":
                text, file_name = payload
                self.text_area.insert("1.0", text or "(Metin bulunamadı)")
                self.status_var.set(f"Tamamlandı: {file_name}")
                finished = True
            elif kind == "error":
                self.status_var.set("Hata oluştu.")
                messagebox.showerror(WINDOW_TITLE, payload[0])
                finished = True

        if finished:
            self.select_button.state(["!disabled"])
        else:
            self.root.after(QUEUE_POLL_MS, self._process_messages)


def main() -> None:
    root = tk.Tk()
    OcrApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
