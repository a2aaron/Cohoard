import init, * as cohoard from "https://static.witchoflight.com/~a2aaron/cohoard-0.1.0/cohoard.js";

await init();


let template = `{#- The div for the background and global font styling.
    The actual font Discord uses is Uni Sans Heavy, but
    most people probably don't have that font installed.
    Hence we use some fallback fonts that look sort of like it. -#}
 <div style="
 font-family: Uni Sans Heavy, Verdana, Helvetica, Arial, sans-serif;
 background-color: #36393E;
 min-height: 128px;
 padding: 16px;
 line-height: 1.375rem;
 margin: -16px -12px;
 color: #DCDDDE;
 font-size: 1rem;">
 
 {#- Begin the list of posts. This first div ensures correct
    spacing and also ensures the avatar appears next to the 
    post body. -#}
 {%- for post in posts -%}
 <div class="single-post-wrapper" 
     style="
     padding-bottom: 8px;
     display: flex;
     flex-direction: row;
     gap: 16px;">
 
 {#- The profile picture for the post. The user avatar URL can 
    point to local files, but this will break when uploading to
    Cohost.-#}
 <div class="poster-avatar"
     style="
     {% if post.user.avatar %}
     background-image: url({{ post.user.avatar | safe }});
     {% elif post.user.color %}
     background: {{ post.user.color }};
     {% else %}
     background: #43b581;
     {% endif %}
     background-repeat: no-repeat;
     background-size: contain;
     border-radius: 50%;
     width: 48px;
     height: 48px;
     flex-shrink: 0; {#- no sizeplay allowed -- avoids the avatars from shrinking due to very long messages. -#}"></div>
 
 {#- We use white-space: nowrap is used to ensures that the timestamp
    doesn't wrap to the next line. and we use overflow-x: hidden to
    clip the timestamp when it would go off-screen.-#}
 <div class="post-body" style="overflow-x: hidden;">
 {#- Post headline. This is the username + timestamp. -#}
 <div class="post-headline" style="white-space: nowrap;">
 <span style="color: {{ post.user.color | default(value="white") }}; font-size: 100%;">{{ post.user.name }}</span>
 <span style="color: #A3A6AA; font-size: 0.75rem; padding-left: 10px;">{{ post.timestamp | default (value = "") }}</span>
 </div>
 
 {#- Message contents (multiple messages are collapsed into 
    a single post body) -#}
 {%- for message in post.messages %}
 <p style="word-wrap: break-word; margin: 4px 0 8px 0;">
 {#- "safe" keyword is required here, because messages will
    sometimes contain newlines, which we add <br>s to. 
    By default, Tera will escape these tags into literal 
    text, but we don't want this (we want actual html tags
    for the newline), so we need to tell Tera that this is
    safe to not escape (even though, technically, it is not.
    This also means that messages that contain literal text
    of HTML tags will end up rendered as actual HTML tags.
    If you want to type HTML tags (that aren't inside code
    blocks), you can escape it with &lt;. -#}
 {{- message | markdown | trim | safe -}}
 </p>
 
 {%- endfor -%}
 
 </div>
 </div>
 {%- endfor -%}
 </div>`;

let script_textarea = document.getElementById("script");
let config_textarea = document.getElementById("config");
let preview_area = document.getElementById("preview-output");
let html_area = document.getElementById("html-output");

let config = cohoard.load_config(config_textarea.value);

function render() {
   let posts = cohoard.parse_posts(config, script_textarea.value);

   let rendered = cohoard.render("discord template", template, posts);
   preview_area.innerHTML = rendered;
   html_area.innerText = rendered;
}


script_textarea.addEventListener("input", render)

config_textarea.addEventListener("input", () => {
   config = cohoard.load_config(config_textarea.value);
   render();
})

render();