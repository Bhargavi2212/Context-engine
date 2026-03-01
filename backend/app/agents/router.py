"""LangGraph router: classify intent and route to agents."""
from typing import Literal

from langgraph.graph import END, StateGraph
from langchain_mistralai import ChatMistralAI

from app.agents.analyst import analyst_node
from app.agents.customer import customer_node
from app.agents.spec_writer import spec_generation_node
from app.agents.state import AgentState


def classify_intent(state: AgentState) -> AgentState:
    """Classify the PM's message intent."""
    llm = ChatMistralAI(model="mistral-medium-latest", temperature=0.1, timeout=120)
    messages = state.get("messages", [])
    if not messages:
        state["intent"] = "general"
        return state
    last = messages[-1]
    content = last.get("content", "") if isinstance(last, dict) else getattr(last, "content", "")
    if not content:
        state["intent"] = "general"
        return state

    response = llm.invoke([
        {"role": "system", "content": """Classify this product manager's message into ONE category:
- "analyst" — questions about patterns, trends, top issues, sentiment, volume, comparisons, priorities, RICE scores, revenue impact across all feedback
- "customer" — questions about specific customers, customer risk, renewals, health scores, churn, customer-level feedback history
- "spec_generation" — requests to generate specs, PRDs, engineering documents, or write requirements
- "general" — greetings, small talk, questions about how the tool works, anything not about data

Return ONLY the category word, nothing else."""},
        {"role": "user", "content": content},
    ])
    intent = (response.content or "").strip().lower().replace('"', "").replace("'", "")
    if intent not in ("analyst", "customer", "spec_generation", "general"):
        intent = "analyst"
    state["intent"] = intent
    return state


def route_by_intent(state: AgentState) -> Literal["analyst", "customer", "spec_generation", "general"]:
    """Route to the correct agent based on classified intent."""
    return state.get("intent", "analyst")


def general_node(state: AgentState) -> AgentState:
    """Handle general questions without tools."""
    llm = ChatMistralAI(model="mistral-medium-latest", temperature=0.7, timeout=120)
    messages = state.get("messages", [])
    lc_messages = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "user":
            lc_messages.append({"role": "user", "content": content})
        elif role == "assistant":
            lc_messages.append({"role": "assistant", "content": content})

    system = "You are Context Engine, a feedback intelligence assistant for Product Managers. Answer general questions about how you work. Keep responses friendly and concise. If the PM seems to be asking a data question, suggest they ask more specifically about issues, trends, customers, or specs."
    response = llm.invoke([{"role": "system", "content": system}, *lc_messages])
    state["agent_response"] = response.content or ""
    return state


workflow = StateGraph(AgentState)
workflow.add_node("classify", classify_intent)
workflow.add_node("analyst", analyst_node)
workflow.add_node("customer", customer_node)
workflow.add_node("spec_generation", spec_generation_node)
workflow.add_node("general", general_node)

workflow.set_entry_point("classify")
workflow.add_conditional_edges(
    "classify",
    route_by_intent,
    {
        "analyst": "analyst",
        "customer": "customer",
        "spec_generation": "spec_generation",
        "general": "general",
    },
)
workflow.add_edge("analyst", END)
workflow.add_edge("customer", END)
workflow.add_edge("spec_generation", END)
workflow.add_edge("general", END)

graph = workflow.compile()
