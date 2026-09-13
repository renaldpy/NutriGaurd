import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { BACKEND_URL } from "./config";

export default function App() {
  return (
    <CopilotKit runtimeUrl={`${BACKEND_URL}/api/copilotkit`}>
      <div
        style={{
          width: 380,
          height: 600,
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ padding: 16, paddingBottom: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: "bold", color: "#e11d48", margin: 0 }}>
            🛒 Family Cart Agent
          </h1>
          <p style={{ fontSize: 13, color: "#555", margin: "8px 0" }}>
            Set up your family profile and scan your cart from the panels on the page
            (🥗 and 🔍 buttons), then ask questions here.
          </p>
        </div>

        <div
          style={{
            flex: 1,
            borderTop: "1px solid #eee",
            minHeight: 0,
          }}
        >
          <CopilotChat
            instructions="You are a dietary assistant analyzing a family's grocery cart. Warn clearly about allergens and suggest alternatives."
            labels={{
              title: "Dietary Assistant",
              initial: "Ask me about allergens or vitamins in your last scanned cart!",
            }}
          />
        </div>
      </div>
    </CopilotKit>
  );
}
