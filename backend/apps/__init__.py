"""Package marker for Django apps package.

Turning `apps/` into a regular package (not a namespace package) fixes unittest
discovery which requires module __file__ to be present for path resolution.
"""

__all__ = [
    # keep this package intentionally empty; apps live in subpackages
]
