import page from 'page';
import body from './home.html?raw';
import setBackgroundImage from '../../shared/bg';

page('/', () => {
    document.body.innerHTML = body;
    setBackgroundImage();
});
