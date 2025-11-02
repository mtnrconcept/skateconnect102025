"""
Training script for Temporal Convolutional Network (TCN)
Lightweight alternative to ST-GCN for real-time inference
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import json
import numpy as np

TRICKS = [
    'ollie', 'nollie', 'shove-it', 'pop-shove-it',
    'kickflip', 'heelflip', '180-front', '180-back',
    '360-front', '360-back', 'boardslide', '50-50',
]


class FeatureDataset(Dataset):
    """Dataset for temporal features"""
    def __init__(self, data_path: str, split: str = 'train'):
        with open(data_path, 'r') as f:
            self.data = json.load(f)
        
        self.sequences = [
            item for item in self.data 
            if item.get('split') == split
        ]
    
    def __len__(self):
        return len(self.sequences)
    
    def __getitem__(self, idx):
        item = self.sequences[idx]
        # Features: [T, F] where T = timesteps, F = feature_dim
        features = np.array(item['features'])
        
        # Normalize
        features = (features - features.mean(axis=0)) / (features.std(axis=0) + 1e-8)
        
        features = torch.from_numpy(features).float()
        
        label = item['label']
        label_idx = TRICKS.index(label) if label in TRICKS else len(TRICKS)
        
        return {
            'features': features,
            'label': torch.tensor(label_idx, dtype=torch.long),
        }


class TCN(nn.Module):
    """
    Tiny Temporal Convolutional Network for real-time inference
    Optimized for ONNX export
    """
    def __init__(
        self,
        input_size: int = 128,  # feature dimension
        num_channels: List[int] = [64, 64, 64],  # hidden layers
        num_class: int = len(TRICKS),
        kernel_size: int = 3,
    ):
        super(TCN, self).__init__()
        
        layers = []
        num_levels = len(num_channels)
        
        for i in range(num_levels):
            dilation = 2 ** i
            in_channels = input_size if i == 0 else num_channels[i - 1]
            out_channels = num_channels[i]
            
            layers.append(
                nn.Sequential(
                    nn.Conv1d(
                        in_channels,
                        out_channels,
                        kernel_size,
                        dilation=dilation,
                        padding=(kernel_size - 1) * dilation,
                    ),
                    nn.BatchNorm1d(out_channels),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                )
            )
        
        self.tcn_layers = nn.ModuleList(layers)
        
        # Global pooling + classifier
        self.global_pool = nn.AdaptiveAvgPool1d(1)
        self.fc = nn.Linear(num_channels[-1], num_class)
    
    def forward(self, x):
        """
        x: [B, T, F] or [B, F, T] after transpose
        """
        if x.dim() == 3 and x.size(1) != self.tcn_layers[0][0].in_channels:
            x = x.transpose(1, 2)  # [B, T, F] -> [B, F, T]
        
        for layer in self.tcn_layers:
            x = layer(x)
        
        x = self.global_pool(x).squeeze(-1)  # [B, F]
        x = self.fc(x)
        
        return x


def train_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    for batch in dataloader:
        features = batch['features'].to(device)
        labels = batch['label'].to(device)
        
        optimizer.zero_grad()
        logits = model(features)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        _, predicted = torch.max(logits.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()
    
    return total_loss / len(dataloader), correct / total


def export_to_onnx(model, output_path: str, input_shape=(1, 150, 128)):
    """Export PyTorch model to ONNX for web inference"""
    model.eval()
    dummy_input = torch.randn(*input_shape)
    
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        input_names=['features'],
        output_names=['logits'],
        dynamic_axes={
            'features': {0: 'batch_size', 1: 'sequence_length'},
            'logits': {0: 'batch_size'},
        },
        opset_version=11,
    )
    print(f'Model exported to {output_path}')


def main():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    batch_size = 64
    num_epochs = 30
    learning_rate = 1e-3
    
    train_dataset = FeatureDataset('data/train_features.json', split='train')
    val_dataset = FeatureDataset('data/train_features.json', split='val')
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    model = TCN(input_size=128, num_channels=[64, 64, 64], num_class=len(TRICKS)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    
    best_val_acc = 0
    for epoch in range(num_epochs):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = train_epoch(model, val_loader, criterion, optimizer, device)
        
        print(f'Epoch {epoch+1}/{num_epochs}: Train Loss: {train_loss:.4f}, Val Acc: {val_acc:.4f}')
        
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), 'models/tcn_best.pth')
            export_to_onnx(model, 'models/trick-tcn.onnx', input_shape=(1, 150, 128))
    
    print(f'Training complete. Best validation accuracy: {best_val_acc:.4f}')


if __name__ == '__main__':
    main()

