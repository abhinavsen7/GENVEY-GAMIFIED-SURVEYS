import os
import json
import re
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

class AMDTokenFactoryClient:
    def __init__(self):
        self.api_key = os.getenv("AMD_API_KEY", os.getenv("TOKEN_FACTORY_API_KEY", os.getenv("AMD_TOKEN_FACTORY_KEY", ""))).strip()
        base = os.getenv(
            "AMD_BASE_URL",
            os.getenv("TOKEN_FACTORY_BASE_URL", os.getenv("AMD_TOKEN_FACTORY_URL", "https://developer.amd.com.cn/radeon/api/v1"))
        ).strip().rstrip("/")
        if base.endswith("/chat/completions"):
            base = base[:-len("/chat/completions")]
        self.base_url = base
        self.text_model = os.getenv("AMD_TEXT_MODEL", os.getenv("AMD_MODEL", "Gemma-4-31B-IT")).strip()
        self.vision_model = os.getenv("AMD_VISION_MODEL", "DeepSeek-V4-Flash-Vision-Exp").strip()
        self._models_discovered = False
        self.last_thinking_trace = ""

    def configure(self, api_key: str = None, base_url: str = None, text_model: str = None, vision_model: str = None):
        if api_key:
            self.api_key = api_key.strip()
        if base_url:
            b = base_url.strip().rstrip("/")
            if b.endswith("/chat/completions"):
                b = b[:-len("/chat/completions")]
            self.base_url = b
        if text_model:
            self.text_model = text_model.strip()
        if vision_model:
            self.vision_model = vision_model.strip()
        self._models_discovered = False
        return {
            "status": "configured",
            "base_url": self.base_url,
            "text_model": self.text_model,
            "vision_model": self.vision_model,
            "has_key": bool(self.api_key)
        }

    def get_status(self):
        return {
            "connected": bool(self.api_key),
            "base_url": self.base_url,
            "text_model": self.text_model,
            "vision_model": self.vision_model,
            "has_key": bool(self.api_key)
        }

    async def discover_models(self):
        """Auto-detects available Gemma 4 or fallback models on the user's AMD Token Factory endpoint."""
        if self._models_discovered or not self.api_key:
            return
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{self.base_url}/models", headers=headers)
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    model_ids = [m.get("id", "") for m in data if m.get("id")]
                    if model_ids:
                        gemma_models = [m for m in model_ids if "gemma" in m.lower()]
                        vision_models = [m for m in model_ids if any(k in m.lower() for k in ["vision", "vl", "minicpm", "flash"])]
                        if gemma_models:
                            self.text_model = gemma_models[0]
                        if vision_models:
                            self.vision_model = vision_models[0]
                        self._models_discovered = True
                        print(f"[AMD Token Factory] Active Text Model: {self.text_model} | Vision Model: {self.vision_model}")
        except Exception as e:
            print(f"[AMD Token Factory] Model auto-discovery note: {e}")

    async def chat_json(self, system_prompt: str, user_prompt: str, images_b64: list = None) -> dict:
        await self.discover_models()
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        unified_prompt = f"[SYSTEM DIRECTIVE]\n{system_prompt}\n\n[USER REQUEST]\n{user_prompt}"

        if images_b64:
            content = [{"type": "text", "text": unified_prompt}]
            for img in images_b64[:8]:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{img}"}
                })
            messages = [{"role": "user", "content": content}]
            model_to_use = self.vision_model
        else:
            messages = [{"role": "user", "content": unified_prompt}]
            model_to_use = self.text_model

        last_err = None
        for attempt in range(2):
            payload = {
                "model": model_to_use,
                "messages": messages,
                "temperature": 0.3 + (attempt * 0.05),
                "max_tokens": 1500,
                "stream": True
            }
            try:
                chunks = []
                reasoning_chunks = []
                timeout = httpx.Timeout(connect=10.0, read=28.0, write=10.0, pool=10.0)
                async with httpx.AsyncClient(timeout=timeout) as client:
                    async with client.stream("POST", f"{self.base_url}/chat/completions", headers=headers, json=payload) as resp:
                        if resp.status_code != 200:
                            resp_sync = await client.post(
                                f"{self.base_url}/chat/completions",
                                headers=headers,
                                json={**payload, "stream": False}
                            )
                            resp_sync.raise_for_status()
                            msg = resp_sync.json()["choices"][0]["message"]
                            raw_content = msg.get("content", "")
                            if msg.get("reasoning_content"):
                                reasoning_chunks.append(msg.get("reasoning_content"))
                        else:
                            async for line in resp.aiter_lines():
                                if line.startswith("data: "):
                                    content_str = line[6:].strip()
                                    if content_str == "[DONE]":
                                        break
                                    try:
                                        chunk_data = json.loads(content_str)
                                        choices = chunk_data.get("choices", [])
                                        if choices and len(choices) > 0:
                                            delta = choices[0].get("delta", {})
                                            txt = delta.get("content", "")
                                            if txt:
                                                chunks.append(txt)
                                            r_txt = delta.get("reasoning_content", "")
                                            if r_txt:
                                                reasoning_chunks.append(r_txt)
                                    except Exception:
                                        pass
                            raw_content = "".join(chunks)

                thinking_trace = "".join(reasoning_chunks).strip()
                # Extract <think>...</think> if present in raw_content
                for open_tag, close_tag in [("<think>", "</think>"), ("<|think|>", "</|think|>"), ("<thought>", "</thought>")]:
                    if close_tag in raw_content:
                        parts = raw_content.split(close_tag)
                        extracted_think = parts[0].replace(open_tag, "").strip()
                        if extracted_think:
                            thinking_trace = (thinking_trace + "\n" + extracted_think).strip()
                        raw_content = parts[-1].strip()

                self.last_thinking_trace = thinking_trace

                cleaned = raw_content.strip()
                if "```json" in cleaned:
                    cleaned = cleaned.split("```json")[1].split("```")[0].strip()
                elif "```" in cleaned:
                    cleaned = cleaned.split("```")[1].split("```")[0].strip()

                try:
                    parsed = json.loads(cleaned)
                except json.JSONDecodeError:
                    match = re.search(r"\{.*\}", raw_content, re.DOTALL)
                    if match:
                        parsed = json.loads(match.group(0))
                    else:
                        raise ValueError(f"Could not parse JSON on attempt {attempt+1}: {raw_content[:200]}")

                if isinstance(parsed, dict) and thinking_trace and "thinking_trace" not in parsed:
                    parsed["thinking_trace"] = thinking_trace
                return parsed
            except Exception as e:
                last_err = e
                print(f"[AMD Token Factory] Attempt {attempt+1}/3 failed: {e}")
                await asyncio.sleep(1.0)

        raise RuntimeError(f"AMD Token Factory compilation failed after 3 attempts: {last_err}")

amd_client = AMDTokenFactoryClient()
