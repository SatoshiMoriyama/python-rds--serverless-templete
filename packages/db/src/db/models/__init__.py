"""モデル自動検出

models/ 配下の全 .py ファイルを動的にインポートし、
SQLModel のメタデータにテーブルを自動登録する。
新しいモデルファイルを追加するだけで Alembic が認識する。
"""

import importlib
import pkgutil
from pathlib import Path


def _auto_import_models():
    """models/ 直下およびサブパッケージ内の全モジュールを再帰的にインポート"""
    package_dir = Path(__file__).parent
    base_package = __name__

    # models/ 直下の .py ファイルを検出
    for _importer, module_name, _ispkg in pkgutil.iter_modules([str(package_dir)]):
        importlib.import_module(f"{base_package}.{module_name}")

    # サブパッケージ内も検出
    for subdir in sorted(package_dir.iterdir()):
        if not subdir.is_dir() or subdir.name.startswith(("_", ".")):
            continue
        package_name = f"{base_package}.{subdir.name}"
        for _importer, module_name, _ispkg in pkgutil.iter_modules([str(subdir)]):
            importlib.import_module(f"{package_name}.{module_name}")


_auto_import_models()
