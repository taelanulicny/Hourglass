import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request) {
  try {
    console.log('AI Chat API called');
    
    // Check environment variables
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    const keyLength = process.env.OPENAI_API_KEY?.length || 0;
    
    console.log('Environment check:', {
      hasOpenAIKey: hasApiKey,
      keyLength: keyLength,
      nodeEnv: process.env.NODE_ENV
    });

    if (!hasApiKey) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured',
          debug: {
            hasApiKey,
            keyLength,
            nodeEnv: process.env.NODE_ENV
          }
        },
        { status: 500 }
      );
    }

    // Parse request body
    let messages, focusContext;
    try {
      const body = await request.json();
      messages = body.messages;
      focusContext = body.focusContext;
      console.log('Request data:', { messagesCount: messages?.length, focusContext });
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create a system message that includes focus area context
    const systemMessage = {
      role: 'system',
      content: `You are a helpful AI assistant specialized in providing advice and support for the focus area "${focusContext?.name || 'this area'}". 

Context about this focus area:
- Name: ${focusContext?.name || 'Unknown'}
- Daily Goal: ${focusContext?.goal || 'Not set'} hours
- Time logged this week: ${focusContext?.weekLogged || 0} hours
- Time left today: ${focusContext?.leftToday || 0} hours

Provide personalized, actionable advice related to this focus area. Be encouraging, specific, and helpful. If the user asks about time management, productivity, or goal achievement, provide practical tips tailored to their specific focus area and current progress.`
    };

    // Add the system message at the beginning
    const allMessages = [systemMessage, ...messages];

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: allMessages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      return NextResponse.json({ 
        message: response,
        usage: completion.usage 
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // If it's a quota error, provide a helpful fallback response
      if (openaiError.status === 429) {
        const userMessage = messages[messages.length - 1]?.content || "your question";
        const focusArea = focusContext?.name || 'your focus area';
        const dailyGoal = focusContext?.goal || 'not set';
        
        let contextualTips = "";
        
        // Provide contextual advice based on focus area
        if (focusArea.toLowerCase().includes('school') || focusArea.toLowerCase().includes('study')) {
          contextualTips = `Here's some study advice for "${focusArea}":

1. **Study techniques**: Try the Pomodoro technique (25 min focused, 5 min break) or active recall methods.
2. **Motivation tips**: Break large topics into smaller, manageable chunks to avoid overwhelm.
3. **Focus strategies**: Find your peak study times and create a distraction-free environment.
4. **Retention advice**: Use spaced repetition and practice testing to improve memory retention.`;
        } else if (focusArea.toLowerCase().includes('reserve') || focusArea.toLowerCase().includes('business')) {
          contextualTips = `Here's some business advice for "${focusArea}":

1. **Communication tips**: Be clear and concise in your manufacturer communications.
2. **Relationship building**: Focus on building long-term partnerships rather than just transactions.
3. **Negotiation advice**: Research market rates and come prepared with specific questions.
4. **Follow-up strategies**: Maintain regular contact to keep relationships strong.`;
        } else if (focusArea.toLowerCase().includes('exercise') || focusArea.toLowerCase().includes('fitness')) {
          contextualTips = `Here's some fitness advice for "${focusArea}":

1. **Motivation tips**: Start with activities you enjoy and gradually increase intensity.
2. **Consistency advice**: Focus on building habits rather than perfect workouts.
3. **Recovery guidance**: Listen to your body and take rest days when needed.
4. **Goal setting**: Set realistic, achievable goals to maintain momentum.`;
        } else {
          contextualTips = `Here's some general advice for "${focusArea}":

1. **Focus strategies**: Identify your most productive times and protect them for important work.
2. **Motivation tips**: Break your ${dailyGoal}-hour daily goal into smaller, achievable milestones.
3. **Progress mindset**: Celebrate small wins and learn from setbacks.
4. **Energy management**: Take regular breaks and maintain work-life balance.`;
        }
        
        const fallbackResponse = `I can see you're asking about "${userMessage}" for your focus area "${focusArea}" with a daily goal of ${dailyGoal} hours. 

I'm currently experiencing a quota issue with my AI service, but I can still help you! ${contextualTips}

Would you like me to help you create a specific plan for your focus area?`;

        return NextResponse.json({ 
          message: fallbackResponse,
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        });
      }
      
      throw openaiError;
    }

  } catch (error) {
    console.error('General API error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    // Provide a helpful fallback even for general errors
    const fallbackResponse = `I'm having trouble connecting to my AI service right now, but I can still help you with your focus area "${focusContext?.name || 'your goal'}"!

Here's some quick advice:
- Focus on progress over perfection
- Break large goals into smaller, manageable steps
- Find what motivates you and use it to your advantage
- Learn from setbacks and keep moving forward

Try asking me again in a moment, or let me know what specific advice you need!`;

    return NextResponse.json({ 
      message: fallbackResponse,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }
}
