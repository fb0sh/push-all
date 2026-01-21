use axum::{
    Router,
    extract::{
        Form, Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use chrono::Local;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs::OpenOptions, io::Write, sync::Arc};
use tokio::sync::{Mutex, broadcast};
/* =========================
   全局状态
========================= */

type TxMap = HashMap<String, broadcast::Sender<String>>;

#[derive(Clone)]
struct AppState {
    channels: Arc<Mutex<TxMap>>,
}

/* =========================
   WebSocket Query
========================= */

#[derive(Deserialize)]
struct WsQuery {
    token: String,
}

/* =========================
   Push 表单 / Query
========================= */

#[derive(Deserialize)]
struct PushReq {
    msg: String,            // 必填
    pusher: Option<String>, // 可选
    r#type: Option<String>, // 可选
    level: Option<String>,  // 可选
    date: Option<String>,   // 可选
}

#[derive(Deserialize)]
struct PushQuery {
    token: String,
}

/* =========================
   Payload 输出顺序固定
========================= */

#[derive(Serialize)]
struct PushPayload {
    pusher: Option<String>,
    msg: String,
    r#type: Option<String>,
    level: Option<String>,
    date: Option<String>,
}

/* =========================
   日志工具
========================= */

fn log(content: &str) {
    let st = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let line = format!("[{}] {}", st, content);

    println!("{}", line);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open("push-all-server.log")
        .expect("无法打开日志文件");
    writeln!(file, "{}", line).expect("写日志失败");
}

/* =========================
   WebSocket 处理
========================= */

async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(q): Query<WsQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    if q.token.trim().is_empty() {
        return StatusCode::BAD_REQUEST.into_response();
    }

    log(&format!("Client connected: token={}", q.token));

    ws.on_upgrade(move |socket| handle_socket(socket, q.token, state))
}

async fn handle_socket(mut socket: WebSocket, token: String, state: AppState) {
    let mut channels = state.channels.lock().await;
    let tx = channels
        .entry(token.clone())
        .or_insert_with(|| {
            let (tx, _) = broadcast::channel(100);
            tx
        })
        .clone();
    drop(channels);

    let mut rx = tx.subscribe();

    // 刚连上发送欢迎消息
    let _ = socket.send(Message::Text("connected".into())).await;

    // 心跳 30 秒
    let mut heartbeat = tokio::time::interval(tokio::time::Duration::from_secs(30));

    loop {
        tokio::select! {
            Some(Ok(msg)) = socket.next() => {
                match msg {
                    Message::Text(t) => {
                        log(&format!("Received from client {}: {}", token, t));
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }
            Ok(msg) = rx.recv() => {
                if socket.send(Message::Text(msg.clone())).await.is_err() {
                    break;
                }
                log(&format!("Sent to client {}: {}", token, msg));
            }
            _ = heartbeat.tick() => {
                if socket.send(Message::Ping(vec![])).await.is_err() { break; }
            }
        }
    }

    log(&format!("Client disconnected: token={}", token));
}

/* =========================
   HTTP /push 接口
========================= */

async fn push(
    State(state): State<AppState>,
    Query(q): Query<PushQuery>,
    Form(f): Form<PushReq>,
) -> impl IntoResponse {
    if f.msg.trim().is_empty() {
        return StatusCode::BAD_REQUEST;
    }

    let channels = state.channels.lock().await;
    if let Some(tx) = channels.get(&q.token) {
        // 构造 Payload
        let payload = PushPayload {
            pusher: f.pusher.clone(),
            msg: f.msg.clone(),
            r#type: f.r#type.clone(),
            level: f.level.clone(),
            date: f.date.clone(),
        };

        let payload_str = serde_json::to_string(&payload).unwrap();

        // 发送给 WebSocket 客户端
        let _ = tx.send(payload_str.clone());

        // 日志输出到终端 & 文件
        log(&format!(
            "Push request: pushed_to={}, payload={}",
            q.token, payload_str
        ));

        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

/* =========================
   main
========================= */

#[tokio::main]
async fn main() {
    let state = AppState {
        channels: Arc::new(Mutex::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/push", post(push))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("bind failed");

    log("🚀 Stable push server running on 0.0.0.0:3000");

    axum::serve(listener, app).await.expect("server error");
}
