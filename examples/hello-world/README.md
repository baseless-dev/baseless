```sh
# Hello World
echo -n '"World"' | http http://127.0.0.1:4000/hello

# Insert if not exists "posts/d"
echo -n '{"checks":[{"type":"check","key":"posts/d","versionstamp":null}],"operations":[{"type":"set","key":"posts/d","data":{"title":"AAAA","content":"BBBB"}}]}' | http 127.0.0.1:4000/document/commit

# Get "posts/d"
echo -n '{"path":"posts/d"}' | http 127.0.0.1:4000/document/get

# List "posts"
echo -n '{"prefix":"posts"}' | http 127.0.0.1:4000/document/list
```
