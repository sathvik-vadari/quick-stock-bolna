"""Load prompts from the prompts/ directory."""
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class PromptLoader:
    def __init__(self, prompts_dir: str = "app/prompts"):
        self.prompts_dir = Path(prompts_dir)
        self.prompts_dir.mkdir(parents=True, exist_ok=True)

    def load_prompt(self, prompt_name: str) -> Optional[str]:
        prompt_file = self.prompts_dir / f"{prompt_name}.txt"
        if not prompt_file.exists():
            logger.warning("Prompt file not found: %s", prompt_file)
            return None
        try:
            return prompt_file.read_text(encoding="utf-8").strip()
        except Exception as e:
            logger.error("Error loading prompt %s: %s", prompt_name, e)
            return None

    def get_default_prompt(self) -> str:
        return self.load_prompt("default") or "You are a helpful AI assistant."
