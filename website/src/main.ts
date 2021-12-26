import page from 'page';
import './common';
import './css/styles.css';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import 'github-markdown-css/github-markdown.css';
import 'markdown-it-texmath/css/texmath.css';

import './pages/index';
import './pages/chatroom/lobby';
import './pages/chatroom/simd';
import './pages/pastebin/index';
import './pages/pastebin/viewer';
import './pages/404';

page();
