import page from 'page';
import body from './404.html?raw';
import setBackgroundImage from '../../shared/bg';

page('*', () => {
    document.body.innerHTML = body;
    setBackgroundImage();
});
