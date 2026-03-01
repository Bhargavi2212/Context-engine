"""Customer Agent: customer lookup, risk, renewals with 5 tools."""
from langchain_core.messages import AIMessage, HumanMessage
from langchain_mistralai import ChatMistralAI
from langgraph.prebuilt import create_react_agent

from app.agents.prompts import build_customer_prompt
from app.agents.state import AgentState
from app.agents.tools.customer_tools import get_customer_tools


def customer_node(state: AgentState) -> AgentState:
    """Run the Customer Agent with 5 tools."""
    conn = state.get("conn")
    org_id = state.get("org_id", "")
    product_context = state.get("product_context") or {}

    tools = get_customer_tools(conn, org_id)
    system_prompt = build_customer_prompt(product_context)
    llm = ChatMistralAI(model="mistral-medium-latest", temperature=0.3, timeout=120)

    graph = create_react_agent(model=llm, tools=tools, prompt=system_prompt)

    messages = state.get("messages", [])
    lc_messages = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))

    result = graph.invoke({"messages": lc_messages})
    out_msgs = result.get("messages", [])
    tool_names = {"customer_lookup", "at_risk_customers", "customer_feedback_history", "renewal_tracker", "customer_comparison"}
    output = ""
    for m in reversed(out_msgs):
        if not hasattr(m, "content") or not isinstance(m.content, str):
            continue
        content = (m.content or "").strip()
        if not content:
            continue
        if getattr(m, "tool_calls", None):
            continue
        if content in tool_names or (len(content) < 25 and " " not in content and "_" in content):
            continue
        output = m.content
        break
    state["agent_response"] = output or "I couldn't generate a response. Please try again."
    return state
