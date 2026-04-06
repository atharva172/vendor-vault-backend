const {StateGraph, MessagesAnnotation, START, END} = require('@langchain/langgraph')
const {ChatGoogleGenerativeAI} = require('@langchain/google-genai')
const {ToolMessage, AIMessage} = require('@langchain/core/messages')
const tools = require('./tools')

const googleApiKey =
    process.env.GOOGLE_API_KEY ||
    process.env.Gemini_API_KEY ||
    process.env.GEMINI_API_KEY

if (!googleApiKey) {
    throw new Error('Missing Google API key. Set GOOGLE_API_KEY (or Gemini_API_KEY) in .env')
}

const model = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    temperature: 0.5,
    apiKey: googleApiKey,
})

const modelWithTools = model.bindTools([tools.searchProduct, tools.addProductToCart])

const graph = new StateGraph(MessagesAnnotation)
.addNode('tools', async(state,config)=>{
    const lastMessage = state.messages[state.messages.length-1]
    const toolsCall = lastMessage.tool_calls || []
    const authToken = config?.metadata?.token || config?.configurable?.token

    if (!authToken) {
        throw new Error('Missing auth token for tool execution')
    }

    const toolCallResults = await Promise.all(toolsCall.map(async(toolCall)=>{
        const tool = tools[toolCall.name]
        if(!tool){
            throw new Error(`Tool ${toolCall.name} not found`)
        }
        const toolInput = toolCall.args || {}
        const toolResult = await tool.invoke({
            ...toolInput,
            token: authToken,
        })

        return new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
        })
}))

state.messages.push(...toolCallResults)
return state
})
.addNode(('chat'), async(state, config)=>{
    const response = await modelWithTools.invoke(state.messages)
    const aiResponse = response instanceof AIMessage
        ? response
        : new AIMessage({
            content: response?.content ?? '',
            tool_calls: response?.tool_calls ?? [],
        })

    state.messages.push(aiResponse)
    return state
})
.addEdge(START, 'chat')
.addConditionalEdges('chat', async(state)=>{
    const lastMessage = state.messages[state.messages.length-1]
    if(lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0){
        return 'tools'
    }else{
        return END
    }
})

.addEdge('tools', 'chat')

const agent = graph.compile()

module.exports = agent