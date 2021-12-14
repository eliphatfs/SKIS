import $ from 'jquery';
const LOCAL_DEBUG = true;

const world = {
    host: LOCAL_DEBUG ? "http://localhost:5000" : "https://central.skis.flandre.info",
};

$.ajaxSetup({
    beforeSend: (xhr, options) => {
        options.url = new URL(options.url!, world.host).toString();
    },
    error: (jqXHR, textStatus, errorThrown) => {
        alert("Network error: " + errorThrown);
    }
});

export default world;
