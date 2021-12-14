import page from 'page';
import body from './404.html?raw';

page('*', () => {
    document.body.innerHTML = body;
});
