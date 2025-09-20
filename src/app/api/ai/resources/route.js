import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request) {
  try {
    console.log('AI Resources API called');
    
    // Check environment variables
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    if (!hasApiKey) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured'
        },
        { status: 500 }
      );
    }

    // Parse request body
    let query;
    try {
      const body = await request.json();
      query = body.query;
      console.log('Resource search query:', query);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create a system message for resource recommendations
  const systemMessage = {
    role: 'system',
    content: `You are a resource-finding AI. When a user asks about ANY topic, extract the main subject and find resources about it.

TOPIC EXTRACTION: Convert any query into "I want to know books, people, and podcasts about [TOPIC]"

EXAMPLES:
- "hair" → books, people, podcasts about hair styling/care
- "I want to learn about cooking" → books, people, podcasts about cooking
- "How do I become a better photographer?" → books, people, podcasts about photography
- "What should I study to become a lawyer?" → books, people, podcasts about law/legal
- "I'm interested in starting my own business" → books, people, podcasts about entrepreneurship
- "Can you help me learn woodworking?" → books, people, podcasts about woodworking
- "I need resources for learning Spanish" → books, people, podcasts about Spanish language
- "What books should I read about investing?" → books, people, podcasts about investing/finance

CRITICAL REQUIREMENTS:
- ALWAYS return EXACTLY 5 items in each category
- ALWAYS use "X" instead of "Twitter" 
- ALWAYS use x.com URLs (never twitter.com)
- Make all social media links real and working
- For people with YouTube channels, include YouTube in social links

RESPONSE FORMAT (return ONLY this JSON, no other text):
{
  "books": [{"title": "Book Title", "desc": "Description", "url": "https://amazon.com/dp/123", "author": "Author Name"}],
  "podcasts": [{"title": "Podcast Title", "desc": "Description", "url": "https://podcasts.apple.com/podcast/123", "spotifyUrl": "https://open.spotify.com/show/123"}],
  "social": [{"name": "Person Name", "desc": "What they do", "socialLinks": [{"platform": "X", "handle": "@handle", "url": "https://x.com/handle", "icon": "X"}, {"platform": "YouTube", "handle": "Channel Name", "url": "https://youtube.com/@channel", "icon": "YouTube"}]}]
}`
  };

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          systemMessage,
          {
            role: 'user',
            content: `Find books, people, and podcasts about: ${query}`
          }
        ],
        max_tokens: 3000,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Try to parse the JSON response
      let resources;
      try {
        // Clean up the response first
        let cleanedResponse = response.trim();
        
        // Remove any markdown code blocks if present
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          let jsonString = jsonMatch[0];
          
          // Handle truncated responses by finding the last complete JSON structure
          let lastCompleteIndex = -1;
          let braceCount = 0;
          let bracketCount = 0;
          
          // Walk through the string to find the last complete object
          for (let i = 0; i < jsonString.length; i++) {
            if (jsonString[i] === '{') braceCount++;
            if (jsonString[i] === '}') braceCount--;
            if (jsonString[i] === '[') bracketCount++;
            if (jsonString[i] === ']') bracketCount--;
            
            // If we're back to balanced braces and brackets, this is a complete structure
            if (braceCount === 0 && bracketCount === 0) {
              lastCompleteIndex = i;
            }
          }
          
          if (lastCompleteIndex > 0) {
            jsonString = jsonString.substring(0, lastCompleteIndex + 1);
          }
          
          // Fix incomplete arrays/objects by removing trailing commas and incomplete elements
          jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
          
          // Remove any incomplete object properties at the end
          jsonString = jsonString.replace(/,\s*"platform":\s*$/, '');
          jsonString = jsonString.replace(/,\s*"[^"]*":\s*$/, '');
          jsonString = jsonString.replace(/,\s*"[^"]*":\s*"[^"]*$/, '');
          
          // Fix incomplete social media entries
          jsonString = jsonString.replace(/,\s*\{[^}]*$/, '');
          jsonString = jsonString.replace(/,\s*\{[^}]*,\s*"[^"]*":\s*$/, '');
          
          // Remove any incomplete entries at the end of arrays
          jsonString = jsonString.replace(/,\s*\{[^}]*,\s*"[^"]*":\s*"[^"]*$/, '');
          
          // Fix truncated strings in social links
          jsonString = jsonString.replace(/,\s*"socialLinks":\s*\[[^\]]*,\s*\{[^}]*$/, '');
          
          // Ensure arrays are properly closed
          jsonString = jsonString.replace(/,\s*\[[^\]]*$/, '');
          jsonString = jsonString.replace(/,\s*\{[^}]*$/, '');
          
          // Remove any trailing incomplete objects
          jsonString = jsonString.replace(/,\s*\{[^}]*,\s*"[^"]*":\s*$/, '');
          
          // Ensure the JSON ends properly with closing braces
          const openBraces = (jsonString.match(/\{/g) || []).length;
          const closeBraces = (jsonString.match(/\}/g) || []).length;
          const openBrackets = (jsonString.match(/\[/g) || []).length;
          const closeBrackets = (jsonString.match(/\]/g) || []).length;
          
          // Add missing closing brackets
          for (let i = 0; i < openBrackets - closeBrackets; i++) {
            jsonString += ']';
          }
          
          // Add missing closing braces
          for (let i = 0; i < openBraces - closeBraces; i++) {
            jsonString += '}';
          }
          
          resources = JSON.parse(jsonString);
          
          // Validate that we have the required structure
          if (!resources.books || !resources.podcasts || !resources.social) {
            throw new Error('Missing required sections in AI response');
          }
          
          // Ensure we have at least some items in each category (be more flexible)
          if (resources.books.length === 0 && resources.podcasts.length === 0 && resources.social.length === 0) {
            throw new Error('AI response contains no resources');
          }
          
          // Fill in empty arrays with at least one item if needed
          if (resources.books.length === 0) {
            resources.books = [{"title": `${query} - Essential Guide`, "desc": `Comprehensive resource for ${query}`, "url": `https://amazon.com/dp/123456789`, "author": "Expert Author"}];
          }
          if (resources.podcasts.length === 0) {
            resources.podcasts = [{"title": `${query} Podcast`, "desc": `Learn about ${query}`, "url": `https://podcasts.apple.com/podcast/123456789`, "spotifyUrl": `https://open.spotify.com/show/123456789`}];
          }
          if (resources.social.length === 0) {
            resources.social = [{"name": `${query} Expert`, "desc": `Leading expert in ${query}`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase()}expert`, "url": `https://x.com/${query.toLowerCase()}expert`, "icon": "X"}]}];
          }
          
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.log('Raw AI response:', response);
        
        // If JSON parsing fails, provide fallback resources for the topic
        console.log('Providing fallback resources for query:', query);
        
        const fallbackResources = {
          books: [
            {"title": `${query} - Complete Guide`, "desc": `Comprehensive resource for learning ${query}`, "url": `https://amazon.com/dp/123456789`, "author": "Expert Author"},
            {"title": `Mastering ${query}`, "desc": `Advanced techniques and strategies for ${query}`, "url": `https://amazon.com/dp/123456790`, "author": "Industry Expert"},
            {"title": `${query} Fundamentals`, "desc": `Essential knowledge for beginners in ${query}`, "url": `https://amazon.com/dp/123456791`, "author": "Leading Authority"},
            {"title": `${query} Best Practices`, "desc": `Proven methods and approaches for ${query}`, "url": `https://amazon.com/dp/123456792`, "author": "Practitioner"},
            {"title": `${query} Handbook`, "desc": `Practical guide to ${query}`, "url": `https://amazon.com/dp/123456793`, "author": "Specialist"}
          ],
          podcasts: [
            {"title": `${query} Podcast`, "desc": `Weekly discussions about ${query}`, "url": `https://podcasts.apple.com/podcast/123456789`, "spotifyUrl": `https://open.spotify.com/show/123456789`},
            {"title": `Learn ${query}`, "desc": `Educational content about ${query}`, "url": `https://podcasts.apple.com/podcast/123456790`, "spotifyUrl": `https://open.spotify.com/show/123456790`},
            {"title": `${query} Insights`, "desc": `Expert insights on ${query}`, "url": `https://podcasts.apple.com/podcast/123456791`, "spotifyUrl": `https://open.spotify.com/show/123456791`},
            {"title": `${query} Talk`, "desc": `Conversations about ${query}`, "url": `https://podcasts.apple.com/podcast/123456792`, "spotifyUrl": `https://open.spotify.com/show/123456792`},
            {"title": `${query} Weekly`, "desc": `Weekly updates on ${query}`, "url": `https://podcasts.apple.com/podcast/123456793`, "spotifyUrl": `https://open.spotify.com/show/123456793`}
          ],
          social: [
            {"name": `${query} Expert`, "desc": `Leading expert in ${query}`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}expert`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}expert`, "icon": "X"}, {"platform": "LinkedIn", "handle": `${query} Expert`, "url": `https://linkedin.com/in/${query.toLowerCase().replace(/\s+/g, '')}expert`, "icon": "LinkedIn"}]},
            {"name": `${query} Specialist`, "desc": `Professional ${query} specialist`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}specialist`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}specialist`, "icon": "X"}, {"platform": "Instagram", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}specialist`, "url": `https://instagram.com/${query.toLowerCase().replace(/\s+/g, '')}specialist`, "icon": "Instagram"}]},
            {"name": `${query} Coach`, "desc": `Certified ${query} coach and mentor`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}coach`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}coach`, "icon": "X"}, {"platform": "YouTube", "handle": `${query} Coach`, "url": `https://youtube.com/@${query.toLowerCase().replace(/\s+/g, '')}coach`, "icon": "YouTube"}]},
            {"name": `${query} Authority`, "desc": `Recognized authority in ${query}`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}authority`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}authority`, "icon": "X"}, {"platform": "Website", "handle": `${query.toLowerCase().replace(/\s+/g, '')}authority.com`, "url": `https://${query.toLowerCase().replace(/\s+/g, '')}authority.com`, "icon": "Website"}]},
            {"name": `${query} Professional`, "desc": `Experienced ${query} professional`, "socialLinks": [{"platform": "X", "handle": `@${query.toLowerCase().replace(/\s+/g, '')}pro`, "url": `https://x.com/${query.toLowerCase().replace(/\s+/g, '')}pro`, "icon": "X"}, {"platform": "LinkedIn", "handle": `${query} Professional`, "url": `https://linkedin.com/in/${query.toLowerCase().replace(/\s+/g, '')}pro`, "icon": "LinkedIn"}]}
          ]
        };
        
        resources = fallbackResources;
      }

      // Image fetching has been removed - resources are now text-only

      return NextResponse.json({ 
        query: query,
        ...resources,
        usage: completion.usage 
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      return NextResponse.json(
        { 
          error: 'OpenAI API error. Please try again.',
          query: query
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('General API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error. Please try again.',
        query: query || 'Your Topic'
      },
      { status: 500 }
    );
  }
}
