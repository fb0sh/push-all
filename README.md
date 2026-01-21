// receive
websocat "ws://127.0.0.1:3000/ws?token=abc"

// push simple
curl "http://127.0.0.1:3000/push?token=abc" -d "msg=123"

// push more info
curl "http://127.0.0.1:3000/push?token=abc" -d "msg=hello&pusher=b0sh&type=info&level=info&date=$(date)"

// level for style
level?: "critical" | "info" | "success" | "upsell" | "warning";
