import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('Simple AI Chat API called');
    
    const body = await request.json();
    const { messages, focusContext } = body;
    
    console.log('Request received:', { 
      messagesCount: messages?.length, 
      focusContext: focusContext?.name 
    });

    // For now, just return a simple response to test if the API works
    const lastMessage = messages[messages.length - 1]?.content || 'Hello';
    
    return NextResponse.json({
      message: `I received your message about "${lastMessage}" for the focus area "${focusContext?.name || 'unknown'}". The AI integration is working! Your daily goal is ${focusContext?.goal || 'not set'} hours.`,
      debug: {
        focusContext,
        messageCount: messages?.length
      }
    });

  } catch (error) {
    console.error('Simple AI API error:', error);
    return NextResponse.json(
      { 
        error: 'Simple AI API failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
