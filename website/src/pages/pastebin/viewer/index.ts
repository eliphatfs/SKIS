import page from 'page';
import body from './v.html?raw';
import $ from 'jquery';
import '../../../common';
import MarkdownIt from 'markdown-it';
import MarkdownItMath from 'markdown-it-texmath';
import highlighter from 'highlight.js';

interface PasteBin {
    name: string
    contents: string
}

page('/pastebin/:key', (ctx) => {
    document.body.innerHTML = body;
    
    const key = ctx.params.key;
    const mdRenderer = new MarkdownIt({
        highlight: function (str, lang) {
            if (lang && highlighter.getLanguage(lang)) {
                try {
                    return highlighter.highlight(str, { language: lang, ignoreIllegals: true }).value;
                } catch (__) { }
            }

            return '';  // use external default escaping
        }
    }).use(MarkdownItMath);

    $.getJSON(
        "/pastebin/" + key,
        (data: PasteBin) => {
            console.log(data);
            $("#name-slot").text(data.name);
            $("#content-slot").html(mdRenderer.render(data.contents));
            $("#loading-container").hide(
                "fast",
                () => $("#content-container").show("fast")
            );
        }
    );

    $("#btn-copy").on("click", false);
    $("#btn-copy").on("click", async () => {
        await navigator.clipboard.writeText($("#content-slot").text());
        alert("Copied to clipboard");
    });
});
