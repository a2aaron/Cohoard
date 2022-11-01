# Intro
This document serves to document all breaking changes associated with Cohoard. Specifically, this is only the changes
which cause custom templates to break in some way. This document will also try to list workarounds or alternatives due
to breakage.

# October 31st, 2022
Added "at-macros". An at-macro is written as @KEY.field and can be placed anywhere within a Post or
Timestamp message. These expand to the value of the given field on the given key. For 
example, if you had a message such as `EGGBUG: Hello, @BUGEGG.name!`, then the macro gets
expanded to `EGGBUG: Hello, Bugegg!`, assuming that `BUGEGG` is a key in the Config table
that has a field called `name` and whose value is `Bugegg`.

Note that an at-macro only attempts to expand if it does find a valid key and field, and
the field consists only of alphanumeric characters (and underscore).

Almost all templates will not have to change in order to accomodate this.

# October 31st, 2022
The `posts` global variable in templates is now depreciated in favor of using `ELEMENTS`. These two variables both give
the semantics contents of the script window, but in slightly different ways. Specifically:

The `ELEMENTS` variable consists of an array of enums with the following serde schema:
```rust
#[serde(tag = "type")]
#[serde(rename_all = "lowercase")]
enum ChatlogElement {
    Timestamp { message: String },
    Post { user: User, message: String },
}
```

This turns into the following schema for Tera:
```
- element.type: "post" | "timestamp"

if element.type == "posts":
    - element.message: a single message, where a message is defined as all the text
                       following a "KEY:" marker, up to the next timestamp or next "KEY:" marker.
    - element.user: the user associated with the message

if element.type == "timestamp":
    - element.message: a single message, where the message consists of all the text on the line
                       following the "@" symbol associated with this timestamp.
```

This means that each message in a chatlog corresponds to exactly one element. The same
is true for each timestamp.

The `posts` variable is also an array, but has a different schema:

```rust
struct OldPostBlock {
    messages: Vec<String>,
    user: User,
    timestamp: Option<String>,
}
```

Which means, in Tera, we have
```
- post.messages - an array of messages (where message is still the same as the one defined for ChatlogElements) where
                  the array consists of all of the contigious messages which share the same timestamp and poster
- post.user - the user associated with the block of messages
- post.timestamp - the timestamp associated with the block of messages
```

To highlight the difference between these two schemas, consider the following chatlog
```
EGGBUG: hello!
EGGBUG: i am eggbug!
EGGBUG: i'm the mascot of cohost!
BUGEGG: Hello.
BUGEGG: I am the anti-mascot of cohost
```

Under the `ChatlogElements` scheme, this chatlog parses as 5 different `ChatlogElement`s, each of
which is a post:
```
ELEMENTS[0] = { type: "post", user: [EGGBUG object], message: "hello!" }
ELEMENTS[1] = { type: "post", user: [EGGBUG object], message: "i am eggbug!" }
ELEMENTS[2] = { type: "post", user: [EGGBUG object], message: "i'm the mascot of cohost!" }
ELEMENTS[3] = { type: "post", user: [BUGEGG object], message: "Hello." }
ELEMENTS[4] = { type: "post", user: [BUGEGG object], message: "I am the anti-mascot of cohost" }
```

Under the `OldPostBlock` scheme, this chatlog parses as 2 `OldPostBlock`s
```
posts[0] = { messages: ["hello!",
                        "i am eggbug!",
                        "i'm the mascot of cohost!"],
            user: [EGGBUG object],
            timestamp: "" }
posts[1] = { messages: ["Hello.",
                        "I am the anti-mascot of cohost",
             user: [BUGEGG object],
             timestamp: "" }
```

For templates which do not care about Discord-style post-batching, the following changes
should be made to the template:
- don't iterate over `postblock.messages` anymore, since that will be flatten for you already
- replace `posts` with `ELEMENTS`
- when iterating over `ELEMENTS`, insert checks for the `element.type` value
- use a global variable to track the `timestamp` value, updating it whenever an element's
  type is equal to `timestamp`

For most templates, this comes with no loss in functionality, and allows the template to
customize how it handles post-batching and timestamp changes.

If the template still needs the old behavior, you can convert from `ChatlogElement`s to
`OldPostBlock`s with the following snippet:
```tera
{#- Split the posts stream into chunks of contigious posters. In other words, this transforms the 
   posts, an array of both timestamps and posts, into an array of arrays, where each sub-array is
   of length 3 and contains [timestamp, user, array of messages]. The array of messages will all be
   sent by the same person and contain the same timestamps. This is used to determine when to print
   out a new headline containing the username/avatar/timestamp of a message, and mimics how Discord
   does it (namely, it prints the headline whenever the timestamp of a message is different from the
   previous message, or if the poster of the message is different from the poster of the previous
   message. -#}
{%- set postblocks = [] -%}
{#- Most recent set of messages. This is cleared whenever a new headline is issued -#}
{%- set this_messages = [] -%}
{#- Most recent timestamp -#}
{%- set this_timestamp = "" -%}
{#- Most recent user who posted. The value of an empty string means "no most recent user" and is 
    set to the empty string whenever a new headlien is issued (Tera doesn't seem to have null, so 
    this is the next best option) -#}
{%- set this_user = "" -%}
{%- for ele in ELEMENTS -%}
   {%- set try_make_postblock = false -%}
   {%- if ele.type == "timestamp" -%}
      {#- If there is some previous post, then the timestamp changing requires us to issue a new
          headline, so we push the posts we already have -#}
      {%- if this_user != "" -%}
         {#- For some reason, tera doesn't like nested array literals, so i need to make a temp 
             variable here. I need a nested array because concat will concat the array elements together
             if the with argument is an array (in other words, [1, 2, 3] concated with [4, 5, 6] is 
             [1, 2, 3, 4, 5, 6], not [1, 2, 3, [4, 5, 6]]). However, this isn't what I want--I want
             an array of arrays, so to get around this, we have it concat an array containing a single
             array, which gives us what we want. -#}
         {%- set temp = [this_timestamp, this_user, this_messages]-%}    
         {%- set_global postblocks = postblocks | concat(with=[temp]) -%}
         {%- set_global this_messages = [] -%}
         {%- set_global this_user = "" -%}
      {%- endif -%}
      {#- Update timestamp value. -#}
      {%- set_global this_timestamp = ele.message -%}
   {%- else -%}
      {#- If the speaker changed, issue a new headline. -#}
      {%- if this_user != "" and this_user.key != ele.user.key -%}
         {%- set temp = [this_timestamp, this_user, this_messages]-%}    
         {%- set_global postblocks = postblocks | concat(with=[temp]) -%}
         {%- set_global this_messages = [] -%}
         {%- set_global this_user = "" -%}
      {%- endif -%}
      {%- set_global this_messages = this_messages | concat(with=ele.message) -%}
      {%- set_global this_user = ele.user -%}
   {%- endif -%}
{%- endfor -%}
```

This snippet, when placed at the global scope, produces an array called `postblocks`.
This array contains arrays of length 3, where the first element is the `timestamp`, the 
second element is the `user`, and the third timestamp is the `messages`. (This snippet
can be seen in the Discord template).