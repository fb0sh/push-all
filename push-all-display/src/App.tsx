import {
  Banner,
  TextInput,
  IconButton,
  Details,
  FormControl,
  Button,
  Label,
  useDetails,
  StateLabel,
} from "@primer/react";
import { ArrowUpIcon, SearchIcon, SyncIcon } from "@primer/octicons-react";
import {
  addMessage,
  clearMessages,
  getLatestMessages,
  getMessagesCount,
  PushPayload,
} from "./db";
import { useState, useRef, useEffect } from "react";
import { useInfiniteScroll, useDebounce, useScroll } from "ahooks"; // 1. 引入 useScroll
import { formatTitle, sendPushPayload, getPermissionGranted } from "./utils";
import { getPushWs, getToken, setPushWs, setToken } from "./store";
import WebSocket from "@tauri-apps/plugin-websocket";
import { listen } from "@tauri-apps/api/event";

interface MessageBoxProps {
  message: PushPayload;
}

const MessageBox = ({ message }: MessageBoxProps) => {
  return (
    <Banner
      className="w-full"
      hideTitle={!(message.pusher || message.date)}
      title={formatTitle(message) ?? "Anonymous"}
      variant={message.level ?? "info"}
      description={message.msg}
    />
  );
};

interface Result {
  list: PushPayload[];
  nextId: number | undefined;
  hasMore: boolean;
  total: number;
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  // 2. 使用 useScroll 监听 ref 的滚动状态
  const scroll = useScroll(containerRef);

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword, { wait: 500 });

  const [token, setTokenState] = useState("");
  const [pushWs, setPushWsState] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<"Closed" | "Pending" | "Open">(
    "Closed",
  );

  const { getDetailsProps } = useDetails({ closeOnOutsideClick: true });

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addAMsg = async (payload: PushPayload) => {
    await sendPushPayload(payload);
    await addMessage(payload);
    mutate((prevData) => {
      if (!prevData) return undefined;
      return {
        ...prevData,
        list: [payload, ...prevData.list],
        // 修正总数逻辑：取当前列表长度和 total 的最大值 + 1
        total: Math.max(prevData.total || 0, prevData.list.length) + 1,
      };
    });
  };

  // 加载消息
  const getLoadMoreList = async (data?: Result): Promise<Result> => {
    const lastId = data?.list.slice(-1)[0]?.id;
    const limit = 20;

    const newMessages = await getLatestMessages(
      limit,
      lastId,
      debouncedKeyword,
    );
    let total = 0;
    try {
      total = await getMessagesCount(debouncedKeyword);
    } catch (e) {
      console.error(e);
    }

    // 核心判定：只要返回条数等于 limit，就认为还有下一页
    const hasMore = newMessages.length === limit;

    return {
      list: newMessages,
      nextId: newMessages.slice(-1)[0]?.id,
      hasMore: hasMore,
      total: total,
    };
  };

  const { data, loading, noMore, mutate } = useInfiniteScroll(getLoadMoreList, {
    target: containerRef,
    isNoMore: (d) => d?.hasMore === false,
    threshold: 150,
    reloadDeps: [debouncedKeyword],
  });

  const realTotal = Math.max(data?.total ?? 0, data?.list.length ?? 0);

  // 封装 WebSocket 连接函数
  const connectWebSocket = async (url: string, t: string) => {
    if (!url || !t) return;

    if (ws) {
      await ws.disconnect();
      setWs(null);
      setWsStatus("Closed");
    }

    setWsStatus("Pending");
    try {
      const socket = await WebSocket.connect(`${url}?token=${t}`);
      setWs(socket);
      setWsStatus("Open");

      socket.addListener((msg) => {
        if (typeof msg.data === "string") {
          try {
            if (msg.data === "connected") {
              return;
            }

            const data = JSON.parse(msg.data);
            addAMsg(data);
          } catch (e) {
            console.error(e);
          }
        } else {
          console.warn("非文本消息，不处理：", msg.data);
        }
      });
    } catch (e) {
      setWsStatus("Closed");
      console.error(e);
    }
  };

  useEffect(() => {
    if (!token || !pushWs) return;
    connectWebSocket(pushWs, token);
  }, [token, pushWs]);

  useEffect(() => {
    (async () => {
      await getPermissionGranted();
      const t = await getToken();
      const wsi = await getPushWs();
      setTokenState(t ?? "");
      setPushWsState(wsi ?? "");
    })();
  }, []);

  useEffect(() => {
    const cleanup = listen("tauri://close-requested", async () => {
      if (ws) await ws.disconnect();
    });
    return () => {
      cleanup.then((f) => f());
      if (ws) ws.disconnect();
    };
  }, [ws]);

  // 3. 使用 useScroll 的返回值来判断显示
  const showBackTop = (scroll?.top ?? 0) > 300;

  return (
    // 4. 外层 relative 用于定位悬浮按钮，h-svh 固定高度
    <div className="flex flex-col h-svh bg-transparent p-2 relative">
      <div
        ref={containerRef}
        // 5. 关键：overflow-y-auto 确保容器内部滚动
        className="flex-1 flex flex-col gap-2 p-0.5 overflow-y-auto"
      >
        <Details {...getDetailsProps()} className="w-full">
          <Button as="summary">View Token</Button>
          <FormControl>
            <FormControl.Label>Push Server</FormControl.Label>
            <TextInput
              className="w-full"
              value={pushWs}
              onChange={(e) => setPushWsState(e.target.value)}
              onBlur={async () => {
                await setPushWs(pushWs);
              }}
            />
          </FormControl>

          <FormControl>
            <FormControl.Label>Token</FormControl.Label>
            <TextInput
              className="w-full"
              value={token}
              onChange={(e) => setTokenState(e.target.value)}
              onBlur={async () => {
                await setToken(token);
              }}
            />
          </FormControl>

          <div className="flex flex-col gap-1 mt-1">
            <Label size="large">
              curl http://push-server.rs/push?token=abc -d msg=123 \
            </Label>
            <Label size="large">
              &date=$(date)&pusher=b0sh&type=info&level=high
            </Label>
            <Label size="large">
              level: critical | info | success | upsell | warning
            </Label>
            <Button
              className="w-full"
              variant="danger"
              onClick={async () => {
                await clearMessages();
                // 6. 清空逻辑：列表置空，总数置 0
                mutate((_prevData) => {
                  return {
                    list: [],
                    nextId: undefined,
                    hasMore: false,
                    total: 0,
                  };
                });
              }}
            >
              Clear Messages
            </Button>
          </div>
        </Details>

        <div className="flex gap-2 items-center bg-white/80">
          <TextInput
            leadingVisual={SearchIcon}
            className="w-full"
            placeholder="Filter messages..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <StateLabel
            status={
              wsStatus === "Open"
                ? "issueOpened"
                : wsStatus === "Pending"
                  ? "issueDraft"
                  : "issueClosed"
            }
          >
            {wsStatus}
          </StateLabel>
        </div>

        {data?.list.length === 0 && !loading && (
          <div className="text-center text-gray-400 mt-10">
            No messages found
          </div>
        )}

        {data?.list.map((m) => (
          <MessageBox key={m.id} message={m} />
        ))}

        {/* 底部状态栏 */}
        <div className="py-6 flex justify-center items-center">
          {loading && (
            <div className="flex items-center gap-2 text-gray-500">
              <SyncIcon className="animate-spin" /> Loading...
            </div>
          )}

          {!loading && noMore && data?.list.length !== 0 && (
            <div className="text-gray-400 text-sm font-medium">
              —— End of list (Total: {realTotal}) ——
            </div>
          )}
        </div>
      </div>

      {/* 回到顶部按钮 */}
      {showBackTop && (
        <div className="absolute bottom-6 right-6 z-50">
          <IconButton
            icon={ArrowUpIcon}
            aria-label="Scroll to top"
            variant="default"
            onClick={scrollToTop}
            className="shadow-lg rounded-full bg-white border border-gray-200"
          />
        </div>
      )}
    </div>
  );
}

export default App;
