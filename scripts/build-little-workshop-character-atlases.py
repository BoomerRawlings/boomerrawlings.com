from __future__ import annotations

from collections import deque
from hashlib import sha256
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CELL_WIDTH = 384
CELL_HEIGHT = 512
BASE_COLUMNS = 4
FINAL_COLUMNS = 8
ROWS = 4

FRAME_NAMES = [
    "neutral",
    "inhale-mid",
    "inhale",
    "blink-quarter",
    "blink-half",
    "blink-three-quarter",
    "blink-closed",
    "wide-mid",
    "small-mid",
    "small",
    "open-mid",
    "open",
    "round-mid",
    "round",
    "smile-mid",
    "smile",
    *[f"gesture-{index:02d}" for index in range(16)],
]

CHARACTERS = {
    "pyotter": {
        "directory": ROOT / "src/assets/aristotter/characters/pyotter",
        "source": "character-inbetweens-magenta-v3.png",
        "centroids": np.array(
            [
                [135, 105, 82],
                [232, 220, 201],
                [194, 132, 48],
                [48, 33, 25],
                [247, 244, 233],
            ],
            dtype=np.float32,
        ),
    },
    "mikwhale": {
        "directory": ROOT / "src/assets/aristotter/characters/mikwhale",
        "source": "character-inbetweens-magenta-v4.png",
        "centroids": np.array(
            [
                [78, 137, 154],
                [111, 77, 56],
                [232, 218, 187],
                [43, 31, 28],
                [245, 242, 229],
            ],
            dtype=np.float32,
        ),
    },
}


def split_base_atlas(path: Path) -> list[Image.Image]:
    atlas = Image.open(path).convert("RGBA")
    expected = (CELL_WIDTH * BASE_COLUMNS, CELL_HEIGHT * ROWS)
    if atlas.size != expected:
        raise ValueError(f"{path}: expected {expected}, got {atlas.size}")
    return [
        atlas.crop(
            (
                column * CELL_WIDTH,
                row * CELL_HEIGHT,
                (column + 1) * CELL_WIDTH,
                (row + 1) * CELL_HEIGHT,
            )
        )
        for row in range(ROWS)
        for column in range(BASE_COLUMNS)
    ]


def magenta_background(rgb: np.ndarray) -> np.ndarray:
    """Include the chroma key and its anti-aliased fringe, but not character colors."""
    red, green, blue = np.moveaxis(rgb.astype(np.int16), 2, 0)
    return (
        (red > 112)
        & (blue > 102)
        & (green < 178)
        & ((red - green) > 38)
        & ((blue - green) > 34)
    )


def definite_magenta_background(rgb: np.ndarray) -> np.ndarray:
    red, green, blue = np.moveaxis(rgb.astype(np.int16), 2, 0)
    return (
        (red > 165)
        & (blue > 140)
        & (green < 105)
        & ((red - green) > 95)
        & ((blue - green) > 90)
    )


def connected_components(mask: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    """Return (area, left, top, right, bottom) for 8-connected foreground islands."""
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[tuple[int, int, int, int, int]] = []

    for start_y, start_x in zip(*np.where(mask & ~visited), strict=False):
        if visited[start_y, start_x]:
            continue
        queue: deque[tuple[int, int]] = deque([(int(start_y), int(start_x))])
        visited[start_y, start_x] = True
        area = 0
        left = right = int(start_x)
        top = bottom = int(start_y)
        while queue:
            y, x = queue.popleft()
            area += 1
            left = min(left, x)
            right = max(right, x)
            top = min(top, y)
            bottom = max(bottom, y)
            for next_y in range(max(0, y - 1), min(height, y + 2)):
                for next_x in range(max(0, x - 1), min(width, x + 2)):
                    if mask[next_y, next_x] and not visited[next_y, next_x]:
                        visited[next_y, next_x] = True
                        queue.append((next_y, next_x))
        components.append((area, left, top, right + 1, bottom + 1))
    return components


def exterior_region(candidate: np.ndarray) -> np.ndarray:
    height, width = candidate.shape
    exterior = np.zeros_like(candidate, dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def add(y: int, x: int) -> None:
        if candidate[y, x] and not exterior[y, x]:
            exterior[y, x] = True
            queue.append((y, x))

    for x in range(width):
        add(0, x)
        add(height - 1, x)
    for y in range(height):
        add(y, 0)
        add(y, width - 1)
    while queue:
        y, x = queue.popleft()
        for next_y in range(max(0, y - 1), min(height, y + 2)):
            for next_x in range(max(0, x - 1), min(width, x + 2)):
                add(next_y, next_x)
    return exterior


def propagate_rgb(rgb: np.ndarray, known: np.ndarray, iterations: int = 5) -> np.ndarray:
    """Extend clean interior colors through a rebuilt anti-aliased edge."""
    rgb = rgb.copy()
    known = known.copy()
    for _ in range(iterations):
        expanded_rgb = rgb.copy()
        expanded = known.copy()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            shifted_known = np.roll(known, (dy, dx), axis=(0, 1))
            shifted_rgb = np.roll(rgb, (dy, dx), axis=(0, 1))
            if dy < 0:
                shifted_known[dy:] = False
            elif dy > 0:
                shifted_known[:dy] = False
            if dx < 0:
                shifted_known[:, dx:] = False
            elif dx > 0:
                shifted_known[:, :dx] = False
            take = ~expanded & shifted_known
            expanded_rgb[take] = shifted_rgb[take]
            expanded[take] = True
        rgb = expanded_rgb
        known = expanded
    rgb[~known] = 0
    return rgb


def component_image(rgb: np.ndarray, bounds: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = bounds
    crop_rgb = rgb[top:bottom, left:right].astype(np.float32)
    edge_pixels = np.concatenate(
        (crop_rgb[0], crop_rgb[-1], crop_rgb[:, 0], crop_rgb[:, -1]),
        axis=0,
    )
    edge_key = edge_pixels[magenta_background(edge_pixels.reshape((-1, 1, 3))).ravel()]
    if not len(edge_key):
        raise ValueError("Generated subject crop has no chroma-magenta border")
    background = np.median(edge_key, axis=0)
    red, green, blue = np.moveaxis(crop_rgb, 2, 0)
    score = np.minimum(
        (red - green) / max(1.0, float(background[0] - background[1])),
        (blue - green) / max(1.0, float(background[2] - background[1])),
    )
    spill = exterior_region(score > 0.015)
    alpha = np.ones(score.shape, dtype=np.float32)
    alpha[spill] = 1.0 - np.clip(score[spill], 0.0, 1.0)
    alpha[definite_magenta_background(crop_rgb) & (score > 0.9)] = 0.0
    alpha[alpha < 0.06] = 0.0
    alpha[alpha > 0.985] = 1.0

    safe_alpha = np.maximum(alpha, 0.06)[..., None]
    clean_rgb = (crop_rgb - (1.0 - safe_alpha) * background) / safe_alpha
    clean_rgb = np.clip(clean_rgb, 0, 255)
    hard_image = Image.fromarray(np.where(alpha >= 0.5, 255, 0).astype(np.uint8), "L")
    interior = np.asarray(hard_image.filter(ImageFilter.MinFilter(3)), dtype=np.uint8) >= 255
    clean_rgb = propagate_rgb(clean_rgb.astype(np.uint8), interior, iterations=6)
    clean_rgb[alpha == 0] = 0
    return Image.fromarray(
        np.dstack((clean_rgb, np.rint(alpha * 255.0).astype(np.uint8))),
        "RGBA",
    )


def split_generated_sheet(path: Path) -> list[Image.Image]:
    """Extract whole subjects instead of grid cells; some generated poses cross row lines."""
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.uint8)
    foreground = ~magenta_background(rgb)
    components = [component for component in connected_components(foreground) if component[0] > 8_000]
    if len(components) != BASE_COLUMNS * ROWS:
        sizes = sorted((component[0] for component in components), reverse=True)
        raise ValueError(f"{path}: expected 16 character components, found {len(components)} ({sizes})")

    components.sort(key=lambda component: (component[2] + component[4]) / 2)
    ordered: list[tuple[int, int, int, int, int]] = []
    for row in range(ROWS):
        row_components = components[row * BASE_COLUMNS : (row + 1) * BASE_COLUMNS]
        ordered.extend(sorted(row_components, key=lambda component: (component[1] + component[3]) / 2))

    images = []
    for _, left, top, right, bottom in ordered:
        pad = 4
        left = max(0, left - pad)
        top = max(0, top - pad)
        right = min(rgb.shape[1], right + pad)
        bottom = min(rgb.shape[0], bottom + pad)
        images.append(component_image(rgb, (left, top, right, bottom)))
    return images


def alpha_bbox(image: Image.Image, threshold: int = 28) -> tuple[int, int, int, int]:
    alpha = np.asarray(image.getchannel("A"))
    ys, xs = np.where(alpha >= threshold)
    if not len(xs):
        raise ValueError("Frame has no visible subject")
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def average_bbox(images: list[Image.Image]) -> tuple[int, int, int, int]:
    boxes = np.asarray([alpha_bbox(image) for image in images], dtype=np.float32)
    left, top, right, bottom = np.rint(boxes.mean(axis=0)).astype(int)
    return left, top, right, bottom


def normalize_to_bbox(image: Image.Image, target_images: list[Image.Image]) -> Image.Image:
    left, top, right, bottom = alpha_bbox(image)
    subject = image.crop((left, top, right, bottom))
    target_left, target_top, target_right, target_bottom = average_bbox(target_images)
    target_width = max(1, target_right - target_left)
    target_height = max(1, target_bottom - target_top)
    resized_width = min(target_width, CELL_WIDTH - 8)
    resized_height = min(target_height, CELL_HEIGHT - 8)
    subject = subject.resize((resized_width, resized_height), Image.Resampling.LANCZOS)

    center_x = (target_left + target_right) / 2
    paste_x = round(center_x - resized_width / 2)
    paste_y = target_bottom - resized_height
    paste_x = max(4, min(paste_x, CELL_WIDTH - resized_width - 4))
    paste_y = max(4, min(paste_y, CELL_HEIGHT - resized_height - 4))
    canvas = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT))
    canvas.alpha_composite(subject, (paste_x, paste_y))
    return canvas


def pixels_for(images: list[Image.Image]) -> np.ndarray:
    samples = []
    for image in images:
        array = np.asarray(image.convert("RGBA"))
        visible = array[..., 3] >= 220
        samples.append(array[..., :3][visible][::3])
    return np.concatenate(samples, axis=0).astype(np.float32)


def cluster_stats(
    images: list[Image.Image],
    centroids: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    pixels = pixels_for(images)
    labels = np.argmin(((pixels[:, None, :] - centroids[None, :, :]) ** 2).sum(axis=2), axis=1)
    means = []
    deviations = []
    for index, centroid in enumerate(centroids):
        cluster = pixels[labels == index]
        if len(cluster) < 64:
            means.append(centroid)
            deviations.append(np.full(3, 24.0, dtype=np.float32))
        else:
            means.append(np.median(cluster, axis=0))
            low, high = np.percentile(cluster, (16, 84), axis=0)
            deviations.append(np.maximum((high - low) / 2, 8.0))
    return np.asarray(means), np.asarray(deviations)


def palette_match(
    image: Image.Image,
    source_stats: tuple[np.ndarray, np.ndarray],
    target_stats: tuple[np.ndarray, np.ndarray],
    centroids: np.ndarray,
    strength: float,
) -> Image.Image:
    array = np.asarray(image.convert("RGBA"), dtype=np.float32)
    rgb = array[..., :3]
    source_means, source_deviations = source_stats
    target_means, target_deviations = target_stats
    labels = np.argmin(((rgb[..., None, :] - centroids[None, None, :, :]) ** 2).sum(axis=3), axis=2)
    weights = []
    for index in range(len(centroids)):
        mask = Image.fromarray(np.where(labels == index, 255, 0).astype(np.uint8), "L")
        weights.append(np.asarray(mask.filter(ImageFilter.GaussianBlur(1.35)), dtype=np.float32) / 255.0)
    weight_stack = np.stack(weights, axis=2)
    weight_stack /= np.maximum(weight_stack.sum(axis=2, keepdims=True), 1e-5)

    mapped = np.zeros_like(rgb)
    for index in range(len(centroids)):
        ratio = np.clip(target_deviations[index] / source_deviations[index], 0.72, 1.35)
        candidate = (rgb - source_means[index]) * ratio + target_means[index]
        candidate = rgb * (1.0 - strength) + candidate * strength
        mapped += candidate * weight_stack[..., index, None]
    result = np.dstack((np.clip(mapped, 0, 255), array[..., 3])).astype(np.uint8)
    return Image.fromarray(result, "RGBA")


def normalize_palette(
    image: Image.Image,
    targets: list[Image.Image],
    centroids: np.ndarray,
    strength: float = 1.0,
) -> Image.Image:
    return palette_match(
        image,
        cluster_stats([image], centroids),
        cluster_stats(targets, centroids),
        centroids,
        strength,
    )


def clean_alpha_edges(image: Image.Image) -> Image.Image:
    array = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    original_alpha = array[..., 3]
    hard_mask = Image.fromarray(np.where(original_alpha >= 72, 255, 0).astype(np.uint8), "L")
    alpha = np.asarray(hard_mask.filter(ImageFilter.GaussianBlur(0.58)), dtype=np.uint8)
    interior = np.asarray(hard_mask.filter(ImageFilter.MinFilter(3)), dtype=np.uint8) >= 255
    rgb = propagate_rgb(array[..., :3], interior, iterations=6)
    rgb[alpha == 0] = 0
    return Image.fromarray(np.dstack((rgb, alpha)).astype(np.uint8), "RGBA")


def build_character(name: str, config: dict[str, object]) -> tuple[dict[str, object], list[Image.Image]]:
    directory = Path(config["directory"])
    centroids = np.asarray(config["centroids"], dtype=np.float32)
    base = split_base_atlas(directory / "character-motion-v2.webp")
    generated = split_generated_sheet(directory / "source" / str(config["source"]))

    core = base[:8]
    gestures = base[8:]
    gesture_source_stats = cluster_stats(gestures, centroids)
    core_target_stats = cluster_stats(core, centroids)
    gestures = [
        palette_match(frame, gesture_source_stats, core_target_stats, centroids, 1.0)
        for frame in gestures
    ]
    base = core + gestures

    def midpoint(index: int, endpoint_indexes: tuple[int, int]) -> Image.Image:
        targets = [base[endpoint_indexes[0]], base[endpoint_indexes[1]]]
        normalized = normalize_to_bbox(generated[index], targets)
        return clean_alpha_edges(normalize_palette(normalized, targets, centroids))

    core_midpoints = {
        0: midpoint(0, (0, 1)),
        1: midpoint(1, (0, 2)),
        2: midpoint(2, (2, 3)),
        3: midpoint(3, (0, 4)),
        4: midpoint(4, (0, 5)),
        5: midpoint(5, (0, 6)),
        6: midpoint(6, (0, 7)),
    }

    if name == "pyotter":
        gesture_specs = {
            7: (0, 8),
            8: (8, 9),
            9: (9, 13),
            10: (13, 10),
            11: (10, 13),
            12: (13, 9),
            13: (9, 8),
            14: (8, 0),
        }
        gesture_midpoints = {
            index: midpoint(index, endpoints) for index, endpoints in gesture_specs.items()
        }
        wide_mid = midpoint(15, (0, 5))
        gesture_frames = [
            gesture_midpoints[7],
            base[8],
            gesture_midpoints[8],
            base[9],
            gesture_midpoints[9],
            base[13],
            gesture_midpoints[10],
            base[10],
            gesture_midpoints[11],
            base[13],
            gesture_midpoints[12],
            base[9],
            gesture_midpoints[13],
            base[8],
            gesture_midpoints[14],
            base[0],
        ]
    else:
        gesture_specs = {
            7: (0, 8),
            8: (8, 9),
            9: (9, 10),
            10: (10, 11),
            11: (11, 12),
            12: (12, 13),
            13: (13, 14),
            14: (14, 15),
            15: (15, 0),
        }
        gesture_midpoints = {
            index: midpoint(index, endpoints) for index, endpoints in gesture_specs.items()
        }
        wide_mid = core_midpoints[4].copy()
        gesture_frames = [
            gesture_midpoints[7],
            base[8],
            gesture_midpoints[8],
            base[9],
            gesture_midpoints[9],
            base[10],
            gesture_midpoints[10],
            base[11],
            gesture_midpoints[11],
            base[12],
            base[13],
            gesture_midpoints[13],
            base[14],
            gesture_midpoints[14],
            base[15],
            gesture_midpoints[15],
        ]

    frames = [
        base[0],
        core_midpoints[0],
        base[1],
        core_midpoints[1],
        base[2],
        core_midpoints[2],
        base[3],
        wide_mid,
        core_midpoints[3],
        base[4],
        core_midpoints[4],
        base[5],
        core_midpoints[5],
        base[6],
        core_midpoints[6],
        base[7],
        *gesture_frames,
    ]
    frames = [clean_alpha_edges(frame) for frame in frames]
    if len(frames) != len(FRAME_NAMES):
        raise AssertionError(f"{name}: expected {len(FRAME_NAMES)} frames, got {len(frames)}")

    atlas = Image.new("RGBA", (CELL_WIDTH * FINAL_COLUMNS, CELL_HEIGHT * ROWS))
    frame_metadata = []
    for index, (frame_name, frame) in enumerate(zip(FRAME_NAMES, frames, strict=True)):
        row, column = divmod(index, FINAL_COLUMNS)
        atlas.alpha_composite(frame, (column * CELL_WIDTH, row * CELL_HEIGHT))
        array = np.asarray(frame)
        visible = array[..., 3] > 0
        frame_metadata.append(
            {
                "name": frame_name,
                "column": column,
                "row": row,
                "bbox": list(alpha_bbox(frame)),
                "partialAlphaPixels": int(((array[..., 3] > 0) & (array[..., 3] < 255)).sum()),
                "meanRgb": [
                    round(float(value), 2)
                    for value in array[..., :3][visible].mean(axis=0)
                ],
            }
        )

    output = directory / "character-motion-v3.webp"
    atlas.save(output, "WEBP", quality=94, method=6, exact=True, alpha_quality=100)
    payload = output.read_bytes()
    metadata = {
        "path": output.relative_to(ROOT).as_posix(),
        "width": atlas.width,
        "height": atlas.height,
        "columns": FINAL_COLUMNS,
        "rows": ROWS,
        "cellWidth": CELL_WIDTH,
        "cellHeight": CELL_HEIGHT,
        "bytes": len(payload),
        "sha256": sha256(payload).hexdigest(),
        "frames": frame_metadata,
    }
    return metadata, frames


def main() -> None:
    manifest = {
        "version": 3,
        "frameNames": FRAME_NAMES,
        "characters": {},
    }
    for name, config in CHARACTERS.items():
        metadata, _ = build_character(name, config)
        manifest["characters"][name] = metadata
        print(f"{name}: {metadata['width']}x{metadata['height']}, {metadata['bytes']:,} bytes")
    manifest_path = ROOT / "src/assets/aristotter/characters/character-motion-v3-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"manifest: {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
