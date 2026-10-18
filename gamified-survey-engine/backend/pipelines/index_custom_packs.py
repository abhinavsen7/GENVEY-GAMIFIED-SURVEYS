import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from backend.pipelines.sync_all_user_assets import build_unified_asset_registry

if __name__ == "__main__":
    reg = build_unified_asset_registry()
    print("Saved custom_asset_packs/asset_registry.json:", reg.get("summary", {}))
