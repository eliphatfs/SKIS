import page from 'page';
import body from './home.html?raw';

page('/', () => {
    document.body.innerHTML = body;
});
