"""
Training script for ST-GCN (Spatial Temporal Graph Convolutional Network)
for skateboard trick classification from skeleton sequences
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import json
from typing import List, Dict, Tuple
import numpy as np

# Trick classes (v1)
TRICKS = [
    'ollie', 'nollie', 'shove-it', 'pop-shove-it',
    'kickflip', 'heelflip', '180-front', '180-back',
    '360-front', '360-back', 'boardslide', '50-50',
]

class TrickDataset(Dataset):
    """Dataset loader for trick sequences"""
    def __init__(self, data_path: str, split: str = 'train'):
        with open(data_path, 'r') as f:
            self.data = json.load(f)
        
        # Filter by split
        self.sequences = [
            item for item in self.data 
            if item.get('split') == split
        ]
        
    def __len__(self):
        return len(self.sequences)
    
    def __getitem__(self, idx):
        item = self.sequences[idx]
        # Load skeleton sequence: [T, V, C]
        # T = frames, V = keypoints (33), C = coordinates (x, y, confidence)
        skeletons = np.array(item['skeletons'])  # Shape: [T, 33, 3]
        
        # Normalize coordinates
        skeletons = self.normalize_skeletons(skeletons)
        
        # Convert to tensor: [C=3, T, V]
        skeletons = torch.from_numpy(skeletons).permute(2, 0, 1).float()
        
        label = item['label']
        label_idx = TRICKS.index(label) if label in TRICKS else len(TRICKS)
        
        return {
            'skeletons': skeletons,
            'label': torch.tensor(label_idx, dtype=torch.long),
            'session_id': item.get('session_id', ''),
        }
    
    def normalize_skeletons(self, skeletons):
        """Normalize skeleton coordinates to [-1, 1]"""
        # Normalize by center (hip keypoint) and scale
        if skeletons.shape[0] == 0:
            return skeletons
        
        # Use hip (keypoint 1) as center
        center = skeletons[:, 1, :2].mean(axis=0)
        scale = skeletons[:, :, :2].std()
        
        if scale > 0:
            skeletons[:, :, :2] = (skeletons[:, :, :2] - center) / scale
        
        return skeletons


class STGCN(nn.Module):
    """
    Simplified ST-GCN for skateboard trick classification
    Based on: https://github.com/yysijie/st-gcn
    """
    def __init__(
        self,
        num_nodes: int = 33,  # COCO format keypoints
        in_channels: int = 3,  # x, y, confidence
        num_class: int = len(TRICKS),
        graph_layout: str = 'coco',
    ):
        super(STGCN, self).__init__()
        
        self.num_nodes = num_nodes
        self.graph_layout = graph_layout
        
        # Graph structure (simplified - connect adjacent joints)
        self.adjacency_matrix = self.build_graph()
        
        # Temporal convolution layers
        self.temporal_conv1 = nn.Conv1d(in_channels, 64, kernel_size=9, padding=4)
        self.temporal_conv2 = nn.Conv1d(64, 64, kernel_size=9, padding=4)
        
        # Spatial graph convolution
        self.spatial_conv = nn.Conv2d(64, 128, kernel_size=(1, 1))
        
        # Global average pooling + classifier
        self.global_pool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(128, num_class)
        
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.5)
    
    def build_graph(self):
        """Build adjacency matrix for skeleton graph"""
        # Simplified: connect adjacent joints in COCO format
        adj = torch.zeros(self.num_nodes, self.num_nodes)
        
        # Define connections (parent-child relationships)
        connections = [
            (0, 1), (1, 2), (2, 3), (3, 4),  # head
            (1, 5), (5, 6), (6, 7),  # left arm
            (1, 8), (8, 9), (9, 10),  # right arm
            (1, 11), (11, 12), (12, 13),  # left leg
            (1, 14), (14, 15), (15, 16),  # right leg
        ]
        
        for i, j in connections:
            if i < self.num_nodes and j < self.num_nodes:
                adj[i, j] = 1
                adj[j, i] = 1  # undirected
        
        return adj
    
    def forward(self, x):
        """
        x: [B, C=3, T, V]
        B = batch, C = channels, T = time, V = nodes (keypoints)
        """
        B, C, T, V = x.shape
        
        # Temporal convolution
        x = x.view(B * V, C, T)
        x = self.relu(self.temporal_conv1(x))
        x = self.dropout(x)
        x = self.relu(self.temporal_conv2(x))
        x = x.view(B, V, 64, T).permute(0, 2, 3, 1)  # [B, 64, T, V]
        
        # Spatial graph convolution (simplified - use adjacency)
        adj = self.adjacency_matrix.to(x.device)
        x = torch.matmul(x, adj.unsqueeze(0).unsqueeze(0))  # [B, 64, T, V]
        x = self.spatial_conv(x.permute(0, 1, 3, 2))  # [B, 128, V, T]
        
        # Global pooling
        x = self.global_pool(x)  # [B, 128, 1, 1]
        x = x.view(B, -1)
        
        # Classifier
        x = self.fc(x)
        
        return x


def train_epoch(model, dataloader, criterion, optimizer, device):
    """Train for one epoch"""
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    for batch in dataloader:
        skeletons = batch['skeletons'].to(device)
        labels = batch['label'].to(device)
        
        optimizer.zero_grad()
        logits = model(skeletons)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        _, predicted = torch.max(logits.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()
    
    return total_loss / len(dataloader), correct / total


def validate(model, dataloader, criterion, device):
    """Validate model"""
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    
    with torch.no_grad():
        for batch in dataloader:
            skeletons = batch['skeletons'].to(device)
            labels = batch['label'].to(device)
            
            logits = model(skeletons)
            loss = criterion(logits, labels)
            
            total_loss += loss.item()
            _, predicted = torch.max(logits.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
    
    return total_loss / len(dataloader), correct / total


def main():
    # Config
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    batch_size = 32
    num_epochs = 50
    learning_rate = 3e-4
    
    # Datasets
    train_dataset = TrickDataset('data/train_sequences.json', split='train')
    val_dataset = TrickDataset('data/train_sequences.json', split='val')
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    # Model
    model = STGCN(num_nodes=33, in_channels=3, num_class=len(TRICKS)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    
    # Training loop
    best_val_acc = 0
    for epoch in range(num_epochs):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = validate(model, val_loader, criterion, device)
        
        print(f'Epoch {epoch+1}/{num_epochs}:')
        print(f'  Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.4f}')
        print(f'  Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.4f}')
        
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), 'models/stgcn_best.pth')
            print(f'  ✓ Saved best model (val_acc: {val_acc:.4f})')
    
    print(f'\nTraining complete. Best validation accuracy: {best_val_acc:.4f}')


if __name__ == '__main__':
    main()








