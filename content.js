// ================================================================
//  LeetCode C++ AutoSuggest Pro  v5.0
//  Settings-driven — reads from chrome.storage.sync
//  Features toggled at runtime via chrome.runtime.onMessage
// ================================================================
(function () {
  "use strict";

  // ── DEFAULT SETTINGS (mirrors popup defaults) ────────────────
  const DEFAULTS = {
    enabled:           true,   // master on/off
    stlSuggestions:    true,   // C++ STL / DB snippets
    userVars:          true,   // in-file variable extraction
    complexityTooltip: true,   // O() tooltip on hover/navigate
    highlightMatch:    true,   // highlight matched chars in label
    autoTrigger:       true,   // trigger automatically on typing
    maxSuggestions:    12,     // 6 / 12 / 18
    dropdownOpacity:   85,     // 60-100 %
  };

  let CFG = { ...DEFAULTS };

  // Load from storage immediately, then listen for changes
  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.sync.get(DEFAULTS, vals => { CFG = { ...DEFAULTS, ...vals }; });
    chrome.storage.onChanged.addListener((changes) => {
      for (const [k, v] of Object.entries(changes)) CFG[k] = v.newValue;
      // Re-apply opacity live
      if (dropdown) applyOpacity();
    });
  }

  // ── CONSTANTS ────────────────────────────────────────────────
  const DEBOUNCE_MS = 80;
  const MIN_CHARS   = 1;

  // ── KEYWORD BLACKLIST ────────────────────────────────────────
  const CPP_KW = new Set([
    "alignas","alignof","and","and_eq","asm","auto","bitand","bitor","bool",
    "break","case","catch","char","char8_t","char16_t","char32_t","class",
    "compl","concept","const","consteval","constexpr","constinit","const_cast",
    "continue","co_await","co_return","co_yield","decltype","default","delete",
    "do","double","dynamic_cast","else","enum","explicit","export","extern",
    "false","float","for","friend","goto","if","inline","int","long","mutable",
    "namespace","new","noexcept","not","not_eq","nullptr","operator","or","or_eq",
    "private","protected","public","register","reinterpret_cast","requires",
    "return","short","signed","sizeof","static","static_assert","static_cast",
    "struct","switch","template","this","thread_local","throw","true","try",
    "typedef","typeid","typename","union","unsigned","using","virtual","void",
    "volatile","wchar_t","while","xor","xor_eq",
    "std","endl","cin","cout","cerr","string","vector","map","set","pair",
    "queue","stack","deque","list","multiset","multimap","unordered_map",
    "unordered_set","priority_queue","array","bitset","tuple","optional",
    "function","begin","end","size","push","pop","top","front","back",
    "empty","clear","insert","erase","find","count","sort","reverse","swap",
    "make_pair","make_tuple","get","first","second","main","include","define",
    "ifndef","ifdef","endif","pragma","iota","abs","max","min","gcd","lcm",
    "lower_bound","upper_bound","accumulate","fill","copy","move","next","prev"
  ]);

  // ── COMPLEXITY DATABASE ──────────────────────────────────────
  const CX = {
    "vector<int>":                                   { time:"O(1)",           space:"O(n)",       note:"Amortised O(1) push_back" },
    "vector<vector<int>>":                           { time:"O(m·n)",         space:"O(m·n)",     note:"m rows × n cols" },
    "unordered_map<int,int>":                        { time:"O(1) avg",       space:"O(n)",       note:"O(n) worst-case on hash collision" },
    "unordered_map<string,int>":                     { time:"O(1) avg",       space:"O(n)",       note:"Key hash is O(|key|)" },
    "unordered_set<int>":                            { time:"O(1) avg",       space:"O(n)",       note:"O(n) worst-case" },
    "map<int,int>":                                  { time:"O(log n)",       space:"O(n)",       note:"Red-black tree; ordered" },
    "map<string,int>":                               { time:"O(log n)",       space:"O(n)",       note:"Key compare O(|key|)" },
    "set<int>":                                      { time:"O(log n)",       space:"O(n)",       note:"No duplicates; ordered" },
    "multiset<int>":                                 { time:"O(log n)",       space:"O(n)",       note:"Allows duplicate elements" },
    "priority_queue<int>":                           { time:"O(log n)",       space:"O(n)",       note:"push/pop O(log n); top O(1)" },
    "priority_queue<int,vector<int>,greater<>>":     { time:"O(log n)",       space:"O(n)",       note:"Min-heap; smallest at top" },
    "stack<int>":                                    { time:"O(1)",           space:"O(n)",       note:"push/pop/top all O(1)" },
    "queue<int>":                                    { time:"O(1)",           space:"O(n)",       note:"push/pop/front all O(1)" },
    "deque<int>":                                    { time:"O(1)",           space:"O(n)",       note:"O(1) push/pop both ends" },
    "bitset<N>":                                     { time:"O(N/64)",        space:"O(N/8) B",   note:"Bitwise ops ~64× faster than bool[]" },
    "sort(begin,end)":                               { time:"O(n log n)",     space:"O(log n)",   note:"Introsort; in-place" },
    "sort(begin,end,greater<>)":                     { time:"O(n log n)",     space:"O(log n)",   note:"Same complexity, descending" },
    "sort with lambda":                              { time:"O(n log n)",     space:"O(log n)",   note:"Comparator must be strict weak order" },
    "reverse(begin,end)":                            { time:"O(n)",           space:"O(1)",       note:"In-place; swaps from both ends" },
    "binary_search(begin,end,x)":                    { time:"O(log n)",       space:"O(1)",       note:"Array must be sorted first" },
    "lower_bound(begin,end,x)":                      { time:"O(log n)",       space:"O(1)",       note:"First iterator ≥ x" },
    "upper_bound(begin,end,x)":                      { time:"O(log n)",       space:"O(1)",       note:"First iterator > x" },
    "accumulate(begin,end,init)":                    { time:"O(n)",           space:"O(1)",       note:"Single pass; needs <numeric>" },
    "*max_element(begin,end)":                       { time:"O(n)",           space:"O(1)",       note:"Linear scan; returns iterator" },
    "*min_element(begin,end)":                       { time:"O(n)",           space:"O(1)",       note:"Linear scan; returns iterator" },
    "count(begin,end,val)":                          { time:"O(n)",           space:"O(1)",       note:"Linear scan for equality" },
    "fill(begin,end,val)":                           { time:"O(n)",           space:"O(1)",       note:"Assigns val to each element" },
    "iota(begin,end,start)":                         { time:"O(n)",           space:"O(1)",       note:"Fills 0,1,2,… in-place" },
    "next_permutation":                              { time:"O(n)",           space:"O(1)",       note:"All n! perms: total O(n!·n)" },
    "unique+erase":                                  { time:"O(n)",           space:"O(1)",       note:"Array must be sorted first" },
    "rotate(begin,mid,end)":                         { time:"O(n)",           space:"O(1)",       note:"3-reversal algorithm" },
    "nth_element":                                   { time:"O(n) avg",       space:"O(1)",       note:"Introselect; O(n²) worst-case" },
    "BFS template":                                  { time:"O(V + E)",       space:"O(V)",       note:"V=vertices, E=edges" },
    "BFS on grid":                                   { time:"O(m · n)",       space:"O(m · n)",   note:"Each cell visited once" },
    "DFS lambda":                                    { time:"O(V + E)",       space:"O(V)",       note:"Stack depth up to O(V)" },
    "DFS on grid":                                   { time:"O(m · n)",       space:"O(m · n)",   note:"Stack depth up to m·n" },
    "binary search template":                        { time:"O(log n)",       space:"O(1)",       note:"Halves search space each step" },
    "sliding window":                                { time:"O(n)",           space:"O(1)",       note:"Each element enters/exits once" },
    "two pointers":                                  { time:"O(n)",           space:"O(1)",       note:"Both pointers traverse once" },
    "DP 1D":                                         { time:"O(n)",           space:"O(n)",       note:"Can often compress to O(1)" },
    "DP 2D":                                         { time:"O(m · n)",       space:"O(m · n)",   note:"Row-compress to O(n) space" },
    "memoization map":                               { time:"O(states)",      space:"O(states)",  note:"Each unique state computed once" },
    "Union-Find (DSU)":                              { time:"O(α(n)) ≈ O(1)", space:"O(n)",       note:"α = inverse Ackermann function" },
    "Trie structure":                                { time:"O(L)",           space:"O(Σ·L·n)",   note:"L=key len, Σ=alphabet size" },
    "Segment tree (sum)":                            { time:"O(log n)",       space:"O(n)",       note:"Build O(n); update+query O(log n)" },
    "Dijkstra's algorithm":                          { time:"O((V+E) log V)", space:"O(V)",       note:"No negative-weight edges" },
    "Topological sort (Kahn)":                       { time:"O(V + E)",       space:"O(V)",       note:"Works only on DAGs" },
    "frequency map":                                 { time:"O(n)",           space:"O(n)",       note:"One pass; O(1) avg per insert" },
    "prefix sum":                                    { time:"O(n) build",     space:"O(n)",       note:"Range query O(1) after build" },
    "prefix sum 2D":                                 { time:"O(m·n) build",   space:"O(m·n)",     note:"2D range query O(1) after build" },
    "adj list graph":                                { time:"O(V + E)",       space:"O(V + E)",   note:"Efficient for sparse graphs" },
    "weighted adj list":                             { time:"O(V + E)",       space:"O(V + E)",   note:"Each edge stored twice (undirected)" },
    "__gcd(a,b)":                                    { time:"O(log min(a,b))", space:"O(1)",      note:"Euclidean algorithm" },
    "__builtin_popcount(x)":                         { time:"O(1)",           space:"O(1)",       note:"Single HW instruction on modern CPUs" },
    "pow(base,exp)":                                 { time:"O(log exp)",     space:"O(1)",       note:"Returns double — cast for int power" },
    "s.find(target)":                                { time:"O(n·m)",         space:"O(1)",       note:"n=haystack, m=needle; naive search" },
    "s.substr(pos,len)":                             { time:"O(len)",         space:"O(len)",     note:"Copies len chars; avoid in hot loops" },
    "split string":                                  { time:"O(n)",           space:"O(n)",       note:"n = string length" },
  };

  // ── SUGGESTION DATABASE ──────────────────────────────────────
  const DB = [
    // Data Structures
    { label:"vector<int>",                               detail:"Dynamic array",               snippet:"vector<int> §1;",                                                                    category:"DS",      trigger:["vec","vector"] },
    { label:"vector<vector<int>>",                       detail:"2D grid / matrix",            snippet:"vector<vector<int>> §1(§2, vector<int>(§3, §4));",                                  category:"DS",      trigger:["vec2","vvi","grid","matrix"] },
    { label:"vector<string>",                            detail:"String array",                snippet:"vector<string> §1;",                                                                  category:"DS",      trigger:["vs","vecstr"] },
    { label:"unordered_map<int,int>",                    detail:"Hash map O(1) avg",           snippet:"unordered_map<int,int> §1;",                                                          category:"DS",      trigger:["ump","umap","hashmap"] },
    { label:"unordered_map<string,int>",                 detail:"String→int hash map",         snippet:"unordered_map<string,int> §1;",                                                       category:"DS",      trigger:["umps","smapi"] },
    { label:"unordered_set<int>",                        detail:"Hash set O(1) avg",           snippet:"unordered_set<int> §1;",                                                              category:"DS",      trigger:["uset","hashset","ust"] },
    { label:"map<int,int>",                              detail:"Ordered map O(log n)",        snippet:"map<int,int> §1;",                                                                    category:"DS",      trigger:["map","omap"] },
    { label:"map<string,int>",                           detail:"String→int ordered map",      snippet:"map<string,int> §1;",                                                                 category:"DS",      trigger:["maps","smapi2"] },
    { label:"set<int>",                                  detail:"Ordered set O(log n)",        snippet:"set<int> §1;",                                                                        category:"DS",      trigger:["set","oset"] },
    { label:"multiset<int>",                             detail:"Ordered multiset",            snippet:"multiset<int> §1;",                                                                   category:"DS",      trigger:["mset","multiset"] },
    { label:"priority_queue<int>",                       detail:"Max-heap",                    snippet:"priority_queue<int> §1;",                                                             category:"DS",      trigger:["pq","maxheap","heap"] },
    { label:"priority_queue<int,vector<int>,greater<>>", detail:"Min-heap",                    snippet:"priority_queue<int,vector<int>,greater<int>> §1;",                                    category:"DS",      trigger:["minpq","minheap","pqmin"] },
    { label:"stack<int>",                                detail:"LIFO stack",                  snippet:"stack<int> §1;",                                                                      category:"DS",      trigger:["stk","stack"] },
    { label:"queue<int>",                                detail:"FIFO queue",                  snippet:"queue<int> §1;",                                                                      category:"DS",      trigger:["que","queue"] },
    { label:"deque<int>",                                detail:"Double-ended queue",          snippet:"deque<int> §1;",                                                                      category:"DS",      trigger:["dq","deque"] },
    { label:"pair<int,int>",                             detail:"Integer pair",                snippet:"pair<int,int> §1 = {§2, §3};",                                                       category:"DS",      trigger:["pair","pii"] },
    { label:"tuple<int,int,int>",                        detail:"Triple / tuple",              snippet:"tuple<int,int,int> §1 = {§2, §3, §4};",                                              category:"DS",      trigger:["tup","tuple","tri"] },
    { label:"bitset<N>",                                 detail:"Fixed-size bitset",           snippet:"bitset<§1> §2;",                                                                      category:"DS",      trigger:["bit","bits","bset"] },
    { label:"array<int,N>",                              detail:"Fixed-size array",            snippet:"array<int,§1> §2;",                                                                   category:"DS",      trigger:["arr","fixed"] },
    // Algorithms
    { label:"sort(begin,end)",                           detail:"Sort O(n log n) ascending",  snippet:"sort(§1.begin(), §1.end());",                                                         category:"Algo",    trigger:["sort"] },
    { label:"sort(begin,end,greater<>)",                 detail:"Sort descending",             snippet:"sort(§1.begin(), §1.end(), greater<int>());",                                         category:"Algo",    trigger:["rsort","dsort","sortr"] },
    { label:"sort with lambda",                          detail:"Custom sort comparator",      snippet:"sort(§1.begin(), §1.end(), [](const auto& a, const auto& b){\n\treturn §2;\n});",     category:"Algo",    trigger:["sortl","lcmp"] },
    { label:"reverse(begin,end)",                        detail:"Reverse in-place",            snippet:"reverse(§1.begin(), §1.end());",                                                      category:"Algo",    trigger:["rev","reverse"] },
    { label:"binary_search(begin,end,x)",                detail:"Returns bool",                snippet:"binary_search(§1.begin(), §1.end(), §2)",                                             category:"Algo",    trigger:["bsearch","binsearch"] },
    { label:"lower_bound(begin,end,x)",                  detail:"First iterator >= x",         snippet:"lower_bound(§1.begin(), §1.end(), §2)",                                               category:"Algo",    trigger:["lb","lbound","lower"] },
    { label:"upper_bound(begin,end,x)",                  detail:"First iterator > x",          snippet:"upper_bound(§1.begin(), §1.end(), §2)",                                               category:"Algo",    trigger:["ub","ubound","upper"] },
    { label:"accumulate(begin,end,init)",                detail:"Sum / fold",                  snippet:"accumulate(§1.begin(), §1.end(), §2)",                                                category:"Algo",    trigger:["acc","sum","accum"] },
    { label:"*max_element(begin,end)",                   detail:"Max value in range",          snippet:"*max_element(§1.begin(), §1.end())",                                                  category:"Algo",    trigger:["maxe","maxel"] },
    { label:"*min_element(begin,end)",                   detail:"Min value in range",          snippet:"*min_element(§1.begin(), §1.end())",                                                  category:"Algo",    trigger:["mine","minel"] },
    { label:"count(begin,end,val)",                      detail:"Count occurrences",           snippet:"count(§1.begin(), §1.end(), §2)",                                                     category:"Algo",    trigger:["cnt","count"] },
    { label:"fill(begin,end,val)",                       detail:"Fill range with value",       snippet:"fill(§1.begin(), §1.end(), §2);",                                                     category:"Algo",    trigger:["fill"] },
    { label:"iota(begin,end,start)",                     detail:"Fill 0,1,2,… ascending",      snippet:"iota(§1.begin(), §1.end(), §2);",                                                     category:"Algo",    trigger:["iota"] },
    { label:"next_permutation",                          detail:"Advance to next permutation", snippet:"next_permutation(§1.begin(), §1.end())",                                              category:"Algo",    trigger:["nperm","nextperm"] },
    { label:"unique+erase",                              detail:"Remove duplicate elements",   snippet:"§1.erase(unique(§1.begin(), §1.end()), §1.end());",                                   category:"Algo",    trigger:["uniq","unique","dedup"] },
    { label:"rotate(begin,mid,end)",                     detail:"Rotate range",                snippet:"rotate(§1.begin(), §1.begin()+§2, §1.end());",                                        category:"Algo",    trigger:["rot","rotate"] },
    { label:"nth_element",                               detail:"Partial sort (k-th element)", snippet:"nth_element(§1.begin(), §1.begin()+§2, §1.end());",                                   category:"Algo",    trigger:["nthi","kth"] },
    // Math
    { label:"INT_MAX",                                   detail:"2147483647 (2^31−1)",         snippet:"INT_MAX",                                                                             category:"Math",    trigger:["intmax","imax"] },
    { label:"INT_MIN",                                   detail:"−2147483648 (−2^31)",         snippet:"INT_MIN",                                                                             category:"Math",    trigger:["intmin","imin"] },
    { label:"LLONG_MAX",                                 detail:"Max long long",               snippet:"LLONG_MAX",                                                                           category:"Math",    trigger:["llmax","longmax"] },
    { label:"LLONG_MIN",                                 detail:"Min long long",               snippet:"LLONG_MIN",                                                                           category:"Math",    trigger:["llmin"] },
    { label:"1e9+7 (MOD)",                               detail:"Common modulus 10^9+7",       snippet:"const int MOD = 1e9 + 7;",                                                            category:"Math",    trigger:["mod","1e9","modn"] },
    { label:"abs(x)",                                    detail:"Absolute value",              snippet:"abs(§1)",                                                                             category:"Math",    trigger:["abs"] },
    { label:"max(a,b)",                                  detail:"Maximum of two values",       snippet:"max(§1, §2)",                                                                         category:"Math",    trigger:["max"] },
    { label:"min(a,b)",                                  detail:"Minimum of two values",       snippet:"min(§1, §2)",                                                                         category:"Math",    trigger:["min"] },
    { label:"__gcd(a,b)",                                detail:"GCD",                         snippet:"__gcd(§1, §2)",                                                                       category:"Math",    trigger:["gcd"] },
    { label:"__lcm(a,b)",                                detail:"LCM (C++17)",                 snippet:"lcm(§1, §2)",                                                                         category:"Math",    trigger:["lcm"] },
    { label:"pow(base,exp)",                             detail:"Power (returns double)",      snippet:"(long long)pow(§1, §2)",                                                              category:"Math",    trigger:["pow"] },
    { label:"sqrt(x)",                                   detail:"Square root",                 snippet:"sqrt(§1)",                                                                            category:"Math",    trigger:["sqrt"] },
    { label:"log2(x)",                                   detail:"Log base 2",                  snippet:"(int)log2(§1)",                                                                       category:"Math",    trigger:["log","log2"] },
    { label:"__builtin_popcount(x)",                     detail:"Count set bits",              snippet:"__builtin_popcount(§1)",                                                              category:"Math",    trigger:["pop","popcnt","popcount"] },
    { label:"__builtin_clz(x)",                          detail:"Count leading zeros",         snippet:"__builtin_clz(§1)",                                                                   category:"Math",    trigger:["clz"] },
    { label:"x & (x-1)",                                 detail:"Clear lowest set bit",        snippet:"§1 & (§1 - 1)",                                                                       category:"Math",    trigger:["lowbit","clrbit"] },
    // Snippets
    { label:"for (range-based)",                         detail:"for (auto& x : v)",           snippet:"for (auto& §1 : §2) {\n\t§0\n}",                                                     category:"Snippet", trigger:["for","fore"] },
    { label:"for (index 0→n)",                           detail:"Standard index loop",         snippet:"for (int §1 = 0; §1 < §2; §1++) {\n\t§0\n}",                                         category:"Snippet", trigger:["fori","forin","idx"] },
    { label:"for (reverse)",                             detail:"Reverse index loop",          snippet:"for (int §1 = §2 - 1; §1 >= 0; §1--) {\n\t§0\n}",                                    category:"Snippet", trigger:["forr","forrev","rfor"] },
    { label:"while loop",                                detail:"While loop template",         snippet:"while (§1) {\n\t§0\n}",                                                               category:"Snippet", trigger:["whi","while"] },
    { label:"BFS template",                              detail:"Breadth-first search",        snippet:"queue<int> q;\nq.push(§1);\nvector<bool> vis(§2, false);\nvis[§1] = true;\nwhile (!q.empty()) {\n\tint cur = q.front(); q.pop();\n\t§0\n}", category:"Snippet", trigger:["bfs","BFS"] },
    { label:"BFS on grid",                               detail:"2D grid BFS",                 snippet:"queue<pair<int,int>> q;\nvector<vector<bool>> vis(§1, vector<bool>(§2, false));\nq.push({§3,§4}); vis[§3][§4]=true;\nint dx[]={0,0,1,-1},dy[]={1,-1,0,0};\nwhile(!q.empty()){\n\tauto[x,y]=q.front();q.pop();\n\tfor(int d=0;d<4;d++){\n\t\tint nx=x+dx[d],ny=y+dy[d];\n\t\tif(nx>=0&&nx<§1&&ny>=0&&ny<§2&&!vis[nx][ny]){\n\t\t\tvis[nx][ny]=true;q.push({nx,ny});\n\t\t}\n\t}\n}", category:"Snippet", trigger:["bfsg","gridbfs"] },
    { label:"DFS lambda",                                detail:"DFS with std::function",      snippet:"function<§1(§2)> dfs = [&](§2 §3) -> §1 {\n\t§0\n};\ndfs(§4);",                       category:"Snippet", trigger:["dfs","DFS"] },
    { label:"DFS on grid",                               detail:"Recursive 2D grid DFS",       snippet:"function<void(int,int)> dfs=[&](int x,int y){\n\tif(x<0||x>=§1||y<0||y>=§2||vis[x][y])return;\n\tvis[x][y]=true;\n\t§0\n\tfor(auto[dx,dy]:vector<pair<int,int>>{{0,1},{0,-1},{1,0},{-1,0}})\n\t\tdfs(x+dx,y+dy);\n};\ndfs(§3,§4);", category:"Snippet", trigger:["dfsg","griddfs"] },
    { label:"binary search template",                    detail:"Classic lo/hi bisect",        snippet:"int lo=§1,hi=§2;\nwhile(lo<hi){\n\tint mid=lo+(hi-lo)/2;\n\tif(§3)hi=mid;\n\telse lo=mid+1;\n}\n// lo is the answer", category:"Snippet", trigger:["bs","bst","bisect"] },
    { label:"sliding window",                            detail:"Variable-width window",       snippet:"int l=0,§1=0;\nfor(int r=0;r<(int)§2.size();r++){\n\twhile(§3)l++;\n\t§1=max(§1,r-l+1);\n}", category:"Snippet", trigger:["sw","sliding","window"] },
    { label:"two pointers",                              detail:"Left/right shrink",           snippet:"int l=0,r=(int)§1.size()-1;\nwhile(l<r){\n\t§0\n}",                                   category:"Snippet", trigger:["tp","twop","two"] },
    { label:"DP 1D",                                     detail:"1D DP array",                 snippet:"vector<§1> dp(§2,§3);\ndp[§4]=§5;",                                                  category:"Snippet", trigger:["dp1","dp"] },
    { label:"DP 2D",                                     detail:"2D DP table",                 snippet:"vector<vector<§1>> dp(§2+1,vector<§1>(§3+1,§4));",                                    category:"Snippet", trigger:["dp2","dp2d"] },
    { label:"memoization map",                           detail:"Recursive memo with map",     snippet:"unordered_map<§1,§2> memo;\nfunction<§2(§1)> solve=[&](§1 §3)->§2{\n\tif(memo.count(§3))return memo[§3];\n\t§0\n\treturn memo[§3]=§4;\n};", category:"Snippet", trigger:["memo","memoize"] },
    { label:"Union-Find (DSU)",                          detail:"Disjoint Set Union",          snippet:"vector<int> par(§1),rnk(§1,0);\niota(par.begin(),par.end(),0);\nfunction<int(int)> find=[&](int x)->int{\n\treturn par[x]==x?x:par[x]=find(par[x]);\n};\nauto unite=[&](int a,int b){\n\ta=find(a);b=find(b);\n\tif(a==b)return;\n\tif(rnk[a]<rnk[b])swap(a,b);\n\tpar[b]=a;\n\tif(rnk[a]==rnk[b])rnk[a]++;\n};", category:"Snippet", trigger:["dsu","uf","union"] },
    { label:"Trie structure",                            detail:"Basic prefix trie",           snippet:"struct Trie{\n\tTrie*ch[26]={};\n\tbool end=false;\n\tvoid insert(const string&s){\n\t\tauto*t=this;\n\t\tfor(char c:s){if(!t->ch[c-'a'])t->ch[c-'a']=new Trie();t=t->ch[c-'a'];}\n\t\tt->end=true;\n\t}\n\tbool search(const string&s){\n\t\tauto*t=this;\n\t\tfor(char c:s){if(!t->ch[c-'a'])return false;t=t->ch[c-'a'];}\n\t\treturn t->end;\n\t}\n};", category:"Snippet", trigger:["trie"] },
    { label:"Segment tree (sum)",                        detail:"Point update / range sum",    snippet:"vector<int> tree(4*§1);\nvoid update(int v,int tl,int tr,int pos,int val){\n\tif(tl==tr){tree[v]=val;return;}\n\tint tm=(tl+tr)/2;\n\tif(pos<=tm)update(2*v,tl,tm,pos,val);\n\telse update(2*v+1,tm+1,tr,pos,val);\n\ttree[v]=tree[2*v]+tree[2*v+1];\n}\nint query(int v,int tl,int tr,int l,int r){\n\tif(l>r)return 0;\n\tif(l==tl&&r==tr)return tree[v];\n\tint tm=(tl+tr)/2;\n\treturn query(2*v,tl,tm,l,min(r,tm))+query(2*v+1,tm+1,tr,max(l,tm+1),r);\n}", category:"Snippet", trigger:["seg","segtree","segment"] },
    { label:"Dijkstra's algorithm",                      detail:"Shortest path (weighted)",    snippet:"vector<long long> dist(§1,LLONG_MAX);\npriority_queue<pair<long long,int>,vector<pair<long long,int>>,greater<>> pq;\ndist[§2]=0;pq.push({0,§2});\nwhile(!pq.empty()){\n\tauto[d,u]=pq.top();pq.pop();\n\tif(d>dist[u])continue;\n\tfor(auto[v,w]:adj[u]){\n\t\tif(dist[u]+w<dist[v]){\n\t\t\tdist[v]=dist[u]+w;\n\t\t\tpq.push({dist[v],v});\n\t\t}\n\t}\n}", category:"Snippet", trigger:["dijk","dijkstra","sssp"] },
    { label:"Topological sort (Kahn)",                   detail:"BFS topo sort",               snippet:"vector<int> indeg(§1,0);\nfor(auto&[u,v]:edges)indeg[v]++;\nqueue<int> q;\nfor(int i=0;i<§1;i++)if(!indeg[i])q.push(i);\nvector<int> order;\nwhile(!q.empty()){\n\tint u=q.front();q.pop();\n\torder.push_back(u);\n\tfor(int v:adj[u])if(--indeg[v]==0)q.push(v);\n}", category:"Snippet", trigger:["topo","kahn","toposort"] },
    // Vars
    { label:"int n = v.size()",                          detail:"Store container size",        snippet:"int n=§1.size();",                                                                    category:"Var",     trigger:["nsize","nsz"] },
    { label:"auto [a,b] = pair",                         detail:"Structured binding",          snippet:"auto[§1,§2]=§3;",                                                                     category:"Var",     trigger:["auto","bind"] },
    { label:"frequency map",                             detail:"Count element occurrences",   snippet:"unordered_map<§1,int> freq;\nfor(auto&x:§2)freq[x]++;",                               category:"Var",     trigger:["freq","frequency"] },
    { label:"prefix sum",                                detail:"1D prefix sum array",         snippet:"vector<long long> pre(§1.size()+1,0);\nfor(int i=0;i<(int)§1.size();i++)pre[i+1]=pre[i]+§1[i];", category:"Var", trigger:["pre","prefix","psum"] },
    { label:"prefix sum 2D",                             detail:"2D prefix sum",               snippet:"vector<vector<long long>> pre(§1+1,vector<long long>(§2+1,0));\nfor(int i=1;i<=§1;i++)for(int j=1;j<=§2;j++)\n\tpre[i][j]=§3[i-1][j-1]+pre[i-1][j]+pre[i][j-1]-pre[i-1][j-1];", category:"Var", trigger:["pre2","prefix2"] },
    { label:"adj list graph",                            detail:"Adjacency list",              snippet:"vector<vector<int>> adj(§1);\nfor(auto&[u,v]:edges){\n\tadj[u].push_back(v);\n\tadj[v].push_back(u);\n}", category:"Var", trigger:["adj","graph","adjlist"] },
    { label:"weighted adj list",                         detail:"Adjacency list with weights", snippet:"vector<vector<pair<int,int>>> adj(§1);\nfor(auto&[u,v,w]:edges){\n\tadj[u].push_back({v,w});\n\tadj[v].push_back({u,w});\n}", category:"Var", trigger:["wadj","wgraph"] },
    // String
    { label:"stoi(s)",                                   detail:"String to int",               snippet:"stoi(§1)",                                                                            category:"String",  trigger:["stoi"] },
    { label:"stoll(s)",                                  detail:"String to long long",         snippet:"stoll(§1)",                                                                           category:"String",  trigger:["stoll","stol"] },
    { label:"to_string(n)",                              detail:"Number to string",             snippet:"to_string(§1)",                                                                       category:"String",  trigger:["tostr","tos"] },
    { label:"s.substr(pos,len)",                         detail:"Substring",                   snippet:"§1.substr(§2,§3)",                                                                    category:"String",  trigger:["sub","substr"] },
    { label:"s.find(target)",                            detail:"Find substring / char",       snippet:"§1.find(§2)",                                                                         category:"String",  trigger:["sfind","find"] },
    { label:"s.replace(pos,len,str)",                    detail:"Replace part of string",      snippet:"§1.replace(§2,§3,§4)",                                                                category:"String",  trigger:["srepl","replace"] },
    { label:"split string",                              detail:"Split by delimiter",           snippet:"stringstream ss(§1);\nstring tok;\nvector<string> parts;\nwhile(getline(ss,tok,'§2'))parts.push_back(tok);", category:"String", trigger:["split","tokenize"] },
    { label:"lowercase all",                             detail:"Transform to lowercase",       snippet:"transform(§1.begin(),§1.end(),§1.begin(),::tolower);",                                category:"String",  trigger:["tolower","lower"] },
    // Includes
    { label:"#include <bits/stdc++.h>",                  detail:"All standard headers",        snippet:"#include <bits/stdc++.h>\nusing namespace std;\n",                                    category:"Inc",     trigger:["inc","bits","include","#i"] },
    { label:"using namespace std",                       detail:"std namespace",               snippet:"using namespace std;",                                                                category:"Inc",     trigger:["uns","using"] },
    { label:"typedef long long ll",                      detail:"Short alias for long long",   snippet:"typedef long long ll;",                                                               category:"Inc",     trigger:["ll","typedef","tll"] },
    { label:"#define",                                   detail:"Preprocessor macro",          snippet:"#define §1 §2",                                                                       category:"Inc",     trigger:["def","define"] },
  ];

  // ── INDEX ────────────────────────────────────────────────────
  const IDX = new Map();
  function addToIdx(prefix, sug) {
    prefix = prefix.toLowerCase();
    for (let l=1;l<=prefix.length;l++){const k=prefix.slice(0,l);if(!IDX.has(k))IDX.set(k,new Set());IDX.get(k).add(sug);}
  }
  DB.forEach(s=>{s.trigger.forEach(t=>addToIdx(t,s));addToIdx(s.label.slice(0,12),s);});

  // ── STATE ────────────────────────────────────────────────────
  let dropdown    = null;
  let tooltip     = null;
  let activeIndex = -1;
  let currentEditor = null;
  let lastWord    = "";
  let isVisible   = false;
  let activeSugs  = [];
  let _debTimer   = null;
  let _ttTimer    = null;

  // ── USER SYMBOL EXTRACTION ───────────────────────────────────
  function extractUserSymbols(text, skipWord) {
    if (!CFG.userVars) return [];
    const symbols=[], seen=new Set();
    const pats=[
      /(?:int|long|bool|char|double|float|auto|string|ll)\s+([a-zA-Z_]\w+)/g,
      /(?:vector|map|set|unordered_map|unordered_set|pair|queue|stack|deque|priority_queue|multiset)<[^>]+>\s+([a-zA-Z_]\w+)/g,
      /\b([a-z_][a-zA-Z0-9_]{1,20})\b/g,
    ];
    pats.forEach(re=>{let m;re.lastIndex=0;while((m=re.exec(text))!==null){const n=m[1];if(n&&n!==skipWord&&!CPP_KW.has(n)&&!seen.has(n)&&n.length>=2){seen.add(n);symbols.push({label:n,detail:"In-file symbol",snippet:n,category:"Local"});}}});
    const freq=new Map();const wr=/\b([a-z_][a-zA-Z0-9_]{1,20})\b/g;let m2;
    while((m2=wr.exec(text))!==null){const w=m2[1];if(!CPP_KW.has(w))freq.set(w,(freq.get(w)||0)+1);}
    return symbols.filter(s=>s.label!==skipWord).sort((a,b)=>(freq.get(b.label)||0)-(freq.get(a.label)||0));
  }

  // ── SCORING ──────────────────────────────────────────────────
  function scoreMatch(prefix,candidate){
    const p=prefix.toLowerCase(),c=candidate.toLowerCase();
    if(c===p)return 10;if(c.startsWith(p))return 8;
    const words=c.split(/[\s<>_,()[\]{}:;*&|!#+=-]+/);
    for(const w of words){if(w===p)return 7;if(w.startsWith(p))return 6;}
    if(c.includes(p))return 4;return 0;
  }

  function getSuggestions(word, fullText) {
    if (!word||word.length<MIN_CHARS) return [];
    const p=word.toLowerCase(), results=[], seen=new Set();
    const max = CFG.maxSuggestions || 12;

    if (CFG.stlSuggestions) {
      const fromIdx=IDX.get(p)||new Set();
      const toCheck=fromIdx.size>0?fromIdx:DB;
      toCheck.forEach(s=>{
        const ts=s.trigger?Math.max(...s.trigger.map(t=>scoreMatch(p,t))):0;
        const ls=scoreMatch(p,s.label);const best=Math.max(ts,ls);
        if(best>0&&!seen.has(s.label)){seen.add(s.label);results.push({...s,_score:best});}
      });
      if(fromIdx.size===0){DB.forEach(s=>{if(seen.has(s.label))return;const sc=scoreMatch(p,s.label);if(sc>0){seen.add(s.label);results.push({...s,_score:sc});}});}
    }

    extractUserSymbols(fullText,word).forEach(s=>{
      if(seen.has(s.label))return;const sc=scoreMatch(p,s.label);
      if(sc>0){seen.add(s.label);results.push({...s,_score:sc+0.5});}
    });

    results.sort((a,b)=>b._score-a._score||a.label.length-b.label.length);
    return results.slice(0,max);
  }

  // ── LABEL HIGHLIGHT ──────────────────────────────────────────
  function highlightLabel(label,prefix){
    const frag=document.createDocumentFragment();
    if(!CFG.highlightMatch){frag.appendChild(document.createTextNode(label));return frag;}
    const idx=label.toLowerCase().indexOf(prefix.toLowerCase());
    if(idx===-1){frag.appendChild(document.createTextNode(label));return frag;}
    if(idx>0)frag.appendChild(document.createTextNode(label.slice(0,idx)));
    const hl=document.createElement("mark");hl.className="lc-hl";hl.textContent=label.slice(idx,idx+prefix.length);
    frag.appendChild(hl);frag.appendChild(document.createTextNode(label.slice(idx+prefix.length)));
    return frag;
  }

  // ── OPACITY HELPER ───────────────────────────────────────────
  function applyOpacity(){
    if(!dropdown) return;
    const a=(CFG.dropdownOpacity||85)/100;
    const r=Math.round(15+(1-a)*10),g=Math.round(15+(1-a)*10),b=Math.round(28+(1-a)*10);
    dropdown.style.background=`rgba(${r},${g},${b},${a})`;
    if(tooltip) tooltip.style.background=`rgba(${r+5},${g+5},${b+10},${a})`;
  }

  // ── COMPLEXITY TOOLTIP ───────────────────────────────────────
  function tcColor(t){
    if(!t)return"#94a3b8";const s=t.toLowerCase();
    if(s.includes("o(1)")||s.includes("α"))return"#4ade80";
    if(s.includes("log")&&!s.includes("n log"))return"#a3e635";
    if(s.match(/o\(n\)$/))return"#facc15";
    if(s.includes("n log")||s.includes("v + e"))return"#fb923c";
    if(s.match(/o\(n.?[23]\)/)||s.includes("m·n")||s.includes("m . n"))return"#f87171";
    if(s.includes("states")||s.includes("v)"))return"#c084fc";
    return"#94a3b8";
  }

  function ensureTooltip(){
    if(tooltip)return;
    tooltip=document.createElement("div");tooltip.id="lc-cx-tooltip";
    document.body.appendChild(tooltip);
    tooltip.addEventListener("mouseenter",()=>clearTimeout(_ttTimer));
    tooltip.addEventListener("mouseleave",hideTT);
  }

  function showTT(cx){
    if(!CFG.complexityTooltip){hideTT();return;}
    ensureTooltip();clearTimeout(_ttTimer);
    const tc=tcColor(cx.time),sc=tcColor(cx.space);
    tooltip.innerHTML=`
      <div class="lc-cx-head">Complexity</div>
      <div class="lc-cx-row"><span class="lc-cx-k">Time</span><span class="lc-cx-v" style="color:${tc}">${cx.time}</span></div>
      <div class="lc-cx-row"><span class="lc-cx-k">Space</span><span class="lc-cx-v" style="color:${sc}">${cx.space}</span></div>
      ${cx.note?`<div class="lc-cx-note">${cx.note}</div>`:""}
    `;
    tooltip.style.display="block";applyOpacity();
    const ddBox=dropdown.getBoundingClientRect();
    const activeRow=dropdown.querySelectorAll(".lc-item")[activeIndex];
    const rb=activeRow?activeRow.getBoundingClientRect():ddBox;
    const mid=rb.top+rb.height/2;
    const TW=210,th=tooltip.scrollHeight||110;
    let left=ddBox.right+8,top=mid-th/2;
    if(left+TW>window.innerWidth-8)left=ddBox.left-TW-8;
    top=Math.max(8,Math.min(top,window.innerHeight-th-8));
    tooltip.style.cssText+=`;left:${left}px;top:${top}px;width:${TW}px;`;
  }
  function hideTT(){_ttTimer=setTimeout(()=>{if(tooltip)tooltip.style.display="none";},120);}

  // ── DROPDOWN ─────────────────────────────────────────────────
  function ensureDropdown(){
    if(dropdown)return;
    dropdown=document.createElement("div");dropdown.id="lc-cpp-dropdown";
    dropdown.setAttribute("role","listbox");
    document.body.appendChild(dropdown);
    dropdown.addEventListener("mousedown",e=>e.preventDefault());
  }

  function renderDropdown(sugs,rect){
    ensureDropdown();activeSugs=sugs;activeIndex=-1;dropdown.innerHTML="";
    applyOpacity();

    sugs.forEach((s,i)=>{
      const row=document.createElement("div");row.className="lc-item";row.setAttribute("role","option");
      const badge=document.createElement("span");badge.className=`lc-badge lc-cat-${s.category.toLowerCase()}`;badge.textContent=s.category;
      const lbl=document.createElement("span");lbl.className="lc-label";lbl.appendChild(highlightLabel(s.label,lastWord));
      const det=document.createElement("span");det.className="lc-detail";det.textContent=s.detail;
      row.append(badge,lbl,det);
      if(CX[s.label]&&CFG.complexityTooltip){
        const tag=document.createElement("span");tag.className="lc-cx-tag";tag.textContent="O";row.appendChild(tag);
      }
      row.addEventListener("mouseenter",()=>{setActive(i);const cx=CX[s.label];cx?showTT(cx):hideTT();});
      row.addEventListener("mouseleave",hideTT);
      row.addEventListener("click",()=>doInsert(s));
      dropdown.appendChild(row);
    });

    // Position: always BELOW the cursor line, never overlapping it.
    // rect.top/bottom come from coordsAtPos() which gives the glyph box.
    // We force a minimum clearance of (lineHeight + 4px) below rect.top
    // so the dropdown never covers the current line regardless of font size.
    const W=460,MH=320,M=8;
    const LINE_H = Math.max((rect.bottom - rect.top) || 0, 18); // actual line height
    const BELOW  = rect.top + LINE_H + 4;   // guaranteed below the cursor line
    const ABOVE  = rect.top - 4;            // anchor point when flipping upward

    dropdown.style.cssText+=`;position:fixed;display:block;width:${W}px;max-height:${MH}px;`;
    const ah=Math.min(dropdown.scrollHeight,MH);

    let left = rect.left;
    let top  = BELOW;

    // Flip above if not enough room below viewport
    if (top + ah > window.innerHeight - M) top = ABOVE - ah;

    // Horizontal clamp
    if (left + W > window.innerWidth - M) left = window.innerWidth - W - M;
    if (left < M) left = M;
    // Vertical clamp (after flip)
    if (top < M) top = M;

    dropdown.style.left=left+"px";dropdown.style.top=top+"px";
    isVisible=true;
  }

  function hideDropdown(){if(dropdown)dropdown.style.display="none";hideTT();isVisible=false;activeIndex=-1;activeSugs=[];}

  function setActive(i){
    dropdown.querySelectorAll(".lc-item").forEach((el,j)=>el.classList.toggle("lc-active",j===i));
    activeIndex=i;dropdown.querySelectorAll(".lc-item")[i]?.scrollIntoView({block:"nearest"});
  }
  function navigate(dir){
    if(!isVisible||!activeSugs.length)return false;
    let next=activeIndex+dir;
    if(next<0)next=activeSugs.length-1;if(next>=activeSugs.length)next=0;
    setActive(next);const cx=CX[activeSugs[next]?.label];cx?showTT(cx):hideTT();return true;
  }

  // ── INSERT ───────────────────────────────────────────────────
  function resolveSnippet(raw){return raw.replace(/§[1-9]/g,"").replace(/§0/g,"");}
  function doInsert(sug){
    hideDropdown();if(!currentEditor)return;
    const text=resolveSnippet(sug.snippet||sug.label);
    if(currentEditor.type==="cm6"){const{view,from,to}=currentEditor;view.dispatch({changes:{from,to,insert:text},selection:{anchor:from+text.length}});view.focus();}
    else if(currentEditor.type==="monaco"){const{editor,startColumn,endColumn,lineNumber}=currentEditor;editor.executeEdits("cpp-suggest",[{range:{startLineNumber:lineNumber,endLineNumber:lineNumber,startColumn,endColumn},text}]);editor.focus();}
    else if(currentEditor.type==="plain"){const el=currentEditor.el;if(el.tagName==="TEXTAREA"){const v=el.value;el.value=v.slice(0,currentEditor.start)+text+v.slice(currentEditor.end);el.selectionStart=el.selectionEnd=currentEditor.start+text.length;el.dispatchEvent(new Event("input",{bubbles:true}));el.focus();}}
  }

  // ── EDITOR DETECTION ─────────────────────────────────────────
  function findCMView(el){
    let node=el;
    while(node){for(const key of Object.getOwnPropertyNames(node)){try{const v=node[key];if(v&&typeof v==="object"&&typeof v.dispatch==="function"&&v.state&&typeof v.state.doc==="object"&&v.state.doc.toString)return v;}catch{}}node=node.parentElement;if(node&&node.tagName==="BODY")break;}
    const cands=[...document.querySelectorAll(".cm-editor"),...Array.from(document.querySelectorAll("*")).filter(e=>e.shadowRoot).flatMap(e=>[...e.shadowRoot.querySelectorAll(".cm-editor")])];
    for(const cm of cands){for(const key of Object.getOwnPropertyNames(cm)){try{const v=cm[key];if(v&&typeof v==="object"&&typeof v.dispatch==="function"&&v.state&&v.state.doc)return v;}catch{}}}
    return null;
  }
  function cmWordAt(view){const head=view.state.selection.main.head,line=view.state.doc.lineAt(head),before=line.text.slice(0,head-line.from),m=before.match(/([a-zA-Z_#][a-zA-Z0-9_]*)$/);return{word:m?m[1]:"",from:m?head-m[1].length:head,to:head};}
  function cmRect(view){
    const head=view.state.selection.main.head;
    const coords=view.coordsAtPos(head);
    if(coords){
      // coords.bottom from CM6 is often the same as coords.top (0-height glyph box).
      // Use the actual DOM cursor element height as fallback for line height.
      const curEl=view.dom.querySelector(".cm-cursor,.cm-cursor-primary");
      const lh=curEl?curEl.getBoundingClientRect().height:0;
      const bottom=Math.max(coords.bottom, coords.top+(lh||18));
      return{left:coords.left,top:coords.top,bottom};
    }
    // Fallback: use the cursor DOM element directly
    const cur=view.dom.querySelector(".cm-cursor,.cm-cursor-primary");
    if(cur){const r=cur.getBoundingClientRect();return{left:r.left,top:r.top,bottom:r.bottom};}
    return null;
  }
  function getMonaco(){try{return window.monaco?.editor.getEditors()?.[0]||null;}catch{return null;}}
  function monacoWordAt(ed){const pos=ed.getPosition(),word=ed.getModel().getWordAtPosition(pos);return{word:word?.word||"",startColumn:word?.startColumn||pos.column,endColumn:word?.endColumn||pos.column,lineNumber:pos.lineNumber};}
  function monacoRect(ed){try{const pos=ed.getScrolledVisiblePosition(ed.getPosition()),box=ed.getContainerDomNode().getBoundingClientRect();if(pos)return{left:box.left+pos.left,top:box.top+pos.top,bottom:box.top+pos.top+20};}catch{}return null;}
  function isCodeEditor(el){return!!(el.closest?.(".cm-editor")||el.closest?.(".monaco-editor")||el.closest?.('[class*="CodeMirror"]')||el.closest?.('[class*="code-editor"]')||el.closest?.('[class*="editor-wrapper"]')||el.closest?.('[class*="view-lines"]')||el.closest?.('[class*="inputarea"]')||el.closest?.(".view-line"));}

  // ── MAIN ─────────────────────────────────────────────────────
  function processInput(target){
    if(!CFG.enabled||!CFG.autoTrigger){hideDropdown();return;}
    if(!isCodeEditor(target)){hideDropdown();return;}
    let word="",rect=null,fullText="";
    const cmv=findCMView(target);
    if(cmv){try{const{word:w,from,to}=cmWordAt(cmv);word=w;fullText=cmv.state.doc.toString();rect=cmRect(cmv);currentEditor={type:"cm6",view:cmv,from,to};}catch{}}
    if(!word){const mon=getMonaco();if(mon){try{const{word:w,startColumn,endColumn,lineNumber}=monacoWordAt(mon);word=w;fullText=mon.getModel().getValue();rect=monacoRect(mon);currentEditor={type:"monaco",editor:mon,startColumn,endColumn,lineNumber};}catch{}}}
    if(!word&&target.tagName==="TEXTAREA"){const val=target.value,pos=target.selectionStart,before=val.slice(0,pos),m=before.match(/([a-zA-Z_#][a-zA-Z0-9_]*)$/);if(m){word=m[1];fullText=val;currentEditor={type:"plain",el:target,start:pos-m[1].length,end:pos};const b=target.getBoundingClientRect();rect={left:b.left,top:b.top,bottom:b.bottom};}}
    lastWord=word;
    if(!word||word.length<MIN_CHARS){hideDropdown();return;}
    if(!rect){hideDropdown();return;}
    const sugs=getSuggestions(word,fullText);
    if(!sugs.length){hideDropdown();return;}
    renderDropdown(sugs,rect);
  }

  function handleInput(e){clearTimeout(_debTimer);_debTimer=setTimeout(()=>processInput(e.target),DEBOUNCE_MS);}
  function handleKey(e){
    if(!isVisible)return;
    if(e.key==="ArrowDown"){e.preventDefault();e.stopPropagation();navigate(1);}
    else if(e.key==="ArrowUp"){e.preventDefault();e.stopPropagation();navigate(-1);}
    else if((e.key==="Enter"||e.key==="Tab")&&activeIndex>=0){e.preventDefault();e.stopPropagation();doInsert(activeSugs[activeIndex]);}
    else if(e.key==="Escape"){e.preventDefault();hideDropdown();}
  }

  document.addEventListener("input",handleInput,true);
  document.addEventListener("keydown",handleKey,true);
  document.addEventListener("click",e=>{if(dropdown&&!dropdown.contains(e.target)&&(!tooltip||!tooltip.contains(e.target)))hideDropdown();});
  window.addEventListener("resize",hideDropdown);
  new MutationObserver(()=>{
    if(dropdown&&!document.body.contains(dropdown))document.body.appendChild(dropdown);
    if(tooltip&&!document.body.contains(tooltip))document.body.appendChild(tooltip);
  }).observe(document.body,{childList:true,subtree:true});

})();
