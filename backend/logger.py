import logging
import os
import re
from logging.handlers import RotatingFileHandler
from pathlib import Path


def mask_sensitive(text: str) -> str:
    """Masks potential API keys, bearer tokens, or long banking digits in logs."""
    if not text:
        return ""
    masked = re.sub(r"(vach_|sk-|gsk_|AIza)[A-Za-z0-9_\-]{6,}", r"\1***MASKED***", str(text))
    masked = re.sub(r"\b(\d{4})\d{4,8}(\d{4})\b", r"\1XXXX\2", masked)
    return masked


class SensitiveMaskFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = mask_sensitive(record.msg)
        return True


def setup_logger(name: str = "echotrust") -> logging.Logger:
    log = logging.getLogger(name)
    if log.handlers:
        return log

    log.setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.addFilter(SensitiveMaskFilter())
    log.addHandler(console_handler)

    try:
        log_dir = Path(__file__).resolve().parent / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            log_dir / "echotrust.log", maxBytes=2 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        file_handler.addFilter(SensitiveMaskFilter())
        log.addHandler(file_handler)
    except Exception:
        pass

    return log


logger = setup_logger("echotrust")

