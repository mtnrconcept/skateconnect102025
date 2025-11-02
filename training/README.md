# Training Pipeline for Skate Trick Classification

## Overview

This directory contains training scripts for the AI models used in Game of S.K.A.T.E:
- **ST-GCN**: Spatial Temporal Graph Convolutional Network (skeleton-based)
- **TCN**: Temporal Convolutional Network (feature-based, lightweight)

## Setup

```bash
pip install torch torchvision numpy
```

## Data Format

### Skeleton Sequences (for ST-GCN)
`data/train_sequences.json`:
```json
[
  {
    "session_id": "uuid",
    "label": "kickflip",
    "split": "train",
    "skeletons": [[[x, y, conf], ...], ...]  // [T, 33, 3]
  }
]
```

### Feature Sequences (for TCN)
`data/train_features.json`:
```json
[
  {
    "session_id": "uuid",
    "label": "kickflip",
    "split": "train",
    "features": [[f1, f2, ...], ...]  // [T, 128]
  }
]
```

## Training

### ST-GCN
```bash
python train_stgcn.py
```

### TCN (lightweight)
```bash
python train_tcn.py
```

The TCN script automatically exports to ONNX format (`models/trick-tcn.onnx`) for web deployment.

## Model Conversion

After training, convert MoveNet to ONNX:

```bash
# Download MoveNet Thunder from TensorFlow Hub
# Convert using tf2onnx or tensorflow-onnx
# Place in public/models/movenet-lite.onnx
```

## Next Steps

1. Collect real training data from `skate_ai_sessions` table
2. Annotate clips with ground truth labels
3. Fine-tune models on collected data
4. Deploy ONNX models to `public/models/` for web inference

