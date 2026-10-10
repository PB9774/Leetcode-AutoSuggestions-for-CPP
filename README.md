# ⚡ LeetCode C++ AutoSuggest Pro

A fluid Chrome extension that provides intelligent C++ autosuggestions directly inside LeetCode's code editor.

---

## 🚀 Installation (Chrome / Edge / Brave)

1. Open `chrome://extensions/` in your browser
2. Enable **Developer mode** (toggle top-right)
3. Click **"Load unpacked"**
4. Select the `leetcode-cpp-extension` folder
5. Visit [leetcode.com](https://leetcode.com) and start coding!

---

## ✨ Features

### 57+ Suggestions across 7 categories

| Category   | Examples                                               |
|------------|--------------------------------------------------------|
| **DS**       | `vector<int>`, `unordered_map`, `priority_queue` |
| **Algo**     | `sort()`, `binary_search()`, `lower_bound()`     |
| **Snippet**  | BFS template, DFS lambda, sliding window, DP 1D/2D |
| **Math**     | `INT_MAX`, `__gcd()`, `abs()`, `max()`, `min()`  |
| **Var**      | freq map, visited array, result vector, n=size   |
| **String**   | `stoi()`, `to_string()`, `substr()`, `find()`    |
| **Include**  | `#include <bits/stdc++.h>`, `using namespace std` |

### Smart Fuzzy Matching
- **Prefix match**: type `vec` → `vector<int>`, `vector<vector<int>>`
- **Contains match**: type `map` → all map variants
- **Word boundary match**: type `bfs` → BFS template
- **Scored ranking**: best matches always appear first

### Keyboard Navigation
| Key     | Action              |
|---------|---------------------|
| `↑` `↓` | Navigate list       |
| `Enter` | Insert suggestion   |
| `Tab`   | Insert suggestion   |
| `Esc`   | Dismiss dropdown    |

### Editor Compatibility
- ✅ **CodeMirror 6** (LeetCode's primary editor — CM6 native API)
- ✅ **Monaco Editor** (fallback)
- ✅ **Textarea / contenteditable** (fallback)

---

## 🔧 How It Works

The extension uses a **debounced input listener** (120ms) to avoid lag. On each keystroke it:
1. Detects which editor type is active (CM6 → Monaco → plain)
2. Extracts the current word before the cursor using the editor's own API
3. Runs fuzzy matching against 57+ C++ suggestions
4. Renders a styled dropdown at the cursor position
5. On selection, inserts the snippet using the same editor API (no DOM hacks)

---

## 📁 File Structure

```
leetcode-cpp-extension/
├── manifest.json    — Chrome extension manifest v3
├── content.js       — Main autocomplete engine
├── styles.css       — Dropdown UI styles
├── popup.html       — Extension popup / info panel
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 💡 Usage Tips

- Type **`vec`** for all vector variants
- Type **`map`** for all map/hashmap variants  
- Type **`pq`** for priority queue (min/max heap)
- Type **`bfs`** or **`dfs`** for full search templates
- Type **`dp`** for DP array templates
- Type **`sort`** for sort + custom comparator variants
- Type **`#`** or **`bits`** for the competitive programming header
- Type **`INT`** for `INT_MAX` / `INT_MIN` constants
