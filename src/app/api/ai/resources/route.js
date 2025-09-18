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
          error: 'OpenAI API key not configured',
        fallback: {
          books: [
            { title: `${query} - Essential Guide`, desc: `Comprehensive resource for ${query}`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-guide`, author: "Unknown Author" },
            { title: `Mastering ${query}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering-${query.replace(/\s+/g, '-').toLowerCase()}`, author: "Expert Author" },
            { title: `${query} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-beginners`, author: "Beginner Guide" }
          ],
          podcasts: [
            { title: `${query} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-podcast` },
            { title: `The ${query} Show`, desc: `Expert interviews and tips`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-show` }
          ],
          social: [
            { title: `${query} X`, desc: `Best accounts and communities`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-x` },
            { title: `${query} YouTube`, desc: `Top channels and tutorials`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-youtube` }
          ]
        }
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
    content: `You are an intelligent AI assistant that helps users find relevant resources (books, people, and podcasts) based on ANY topic they're interested in learning about. Your job is to:

1. **Extract the main topic/theme** from the user's query (even if it's vague or conversational)
2. **Understand the user's intent** - what they want to learn about
3. **Provide exactly 5 resources for each category** that are highly relevant to that topic

USER QUERY: "${query}"

INSTRUCTIONS:
1. **Books** - EXACTLY 5 specific, well-known books with real titles and authors
2. **People** - EXACTLY 5 influential people in the field with their social media links  
3. **Podcasts** - EXACTLY 5 specific podcast shows or episodes

IMPORTANT: You MUST provide exactly 5 items for each category. No more, no less.

TOPIC EXTRACTION GUIDELINES:
- If user asks about "lawyers", "attorneys", "legal" → Focus on law and legal professionals
- If user asks about "entrepreneurship", "business", "startups" → Focus on business and entrepreneurship
- If user asks about "fitness", "health", "working out" → Focus on fitness and wellness
- If user asks about "coding", "programming", "tech" → Focus on technology and programming
- If user asks about "cooking", "recipes", "food" → Focus on culinary arts and cooking
- If user asks about "music", "guitar", "piano" → Focus on music and instruments
- If user asks about "photography", "camera", "photos" → Focus on photography
- If user asks about "writing", "books", "author" → Focus on writing and literature
- **For ANY other topic** → Extract the core subject and find relevant resources

INTELLIGENT RESPONSE STRATEGY:
- **Always include the most prominent, recognizable people** in the extracted topic
- **Focus on people who are actively sharing content** and have significant social media presence
- **Choose books that are highly regarded** in that specific field
- **Select podcasts that are popular and relevant** to the topic
- **Ensure diversity** - include different perspectives and approaches within the topic
- **Prioritize real, working URLs** for all resources

SPECIAL INSTRUCTIONS FOR ENTREPRENEURS:
- If the query mentions "entrepreneurship", "entrepreneurs", or specific entrepreneur names like "Alex Hormozi", prioritize well-known entrepreneurs
- Always include David Goggins as the first social media recommendation for motivation and mental toughness
- For Alex Hormozi specifically, include his real social media profiles and books

TOP PODCAST RECOMMENDATIONS:
- Always include "Founders" by David Senra as the first podcast recommendation for entrepreneurship topics
- Founders features biographies of the world's greatest entrepreneurs and is highly regarded in the business community

For each resource, provide:
- A realistic, specific title
- A brief, helpful description
- A REAL, working URL that users can actually visit
- An author field for books (this helps with cover image lookup)

IMPORTANT: Use real URLs that work:
- For books: Use Amazon, Goodreads, or publisher URLs
- For podcasts: Provide BOTH Apple Podcasts AND Spotify URLs when possible
- For people: Include their real social media profiles (X, LinkedIn, YouTube, etc.)

Make the recommendations relevant, specific, and actually useful for someone learning about "${query}". Use real book titles, podcast names, and actual people when possible.

Return your response as a JSON object with this exact structure:
{
  "books": [
    {"title": "Book Title", "desc": "Description", "url": "https://amazon.com/dp/BOOK_ID", "author": "Author Name"}
  ],
  "podcasts": [
    {"title": "Podcast Name", "desc": "Description", "url": "https://podcasts.apple.com/podcast/PODCAST_ID", "spotifyUrl": "https://open.spotify.com/show/SPOTIFY_ID"}
  ],
  "social": [
    {
      "name": "Person Name", 
      "desc": "Their role/expertise", 
      "socialLinks": [
        {"platform": "X", "handle": "@username", "url": "https://x.com/username", "icon": "X"},
        {"platform": "LinkedIn", "handle": "person-name", "url": "https://linkedin.com/in/person-name", "icon": "LinkedIn"},
        {"platform": "YouTube", "handle": "Channel Name", "url": "https://youtube.com/@channel", "icon": "YouTube"}
      ]
    }
  ]
}`
  };

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          systemMessage,
          {
            role: 'user',
            content: `Find resources for learning about: ${query}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Try to parse the JSON response
      let resources;
      try {
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          resources = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.log('Raw AI response:', response);
        
        // Fallback to real resources with working URLs
        resources = {
          books: [
            { title: `Atomic Habits`, desc: `Build good habits and break bad ones`, url: `https://amazon.com/dp/0735211299`, author: "James Clear" },
            { title: `Deep Work`, desc: `Rules for focused success in a distracted world`, url: `https://amazon.com/dp/1455586692`, author: "Cal Newport" },
            { title: `The Lean Startup`, desc: `How today's entrepreneurs use continuous innovation`, url: `https://amazon.com/dp/0307887898`, author: "Eric Ries" }
          ],
          podcasts: [
            { title: `The Tim Ferriss Show`, desc: `Interviews with world-class performers`, url: `https://podcasts.apple.com/podcast/id863897795`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `How I Built This`, desc: `Stories behind successful companies`, url: `https://podcasts.apple.com/podcast/id1154105909`, spotifyUrl: `https://open.spotify.com/show/6E6sTsI8O5j1dpEYFqylx8` }
          ],
        social: [
          {
            name: "David Goggins",
            desc: "Former Navy SEAL, ultra-endurance athlete, and motivational speaker",
            socialLinks: [
              { platform: "X", handle: "@davidgoggins", url: "https://x.com/davidgoggins", icon: "X" },
              { platform: "Instagram", handle: "@davidgoggins", url: "https://instagram.com/davidgoggins", icon: "Instagram" },
              { platform: "YouTube", handle: "David Goggins", url: "https://youtube.com/@DavidGoggins", icon: "YouTube" },
              { platform: "Website", handle: "davidgoggins.com", url: "https://davidgoggins.com", icon: "Website" }
            ]
          },
          {
            name: "Alex Hormozi",
            desc: "Serial entrepreneur, gym owner, and business educator",
            socialLinks: [
              { platform: "X", handle: "@AlexHormozi", url: "https://x.com/AlexHormozi", icon: "X" },
              { platform: "LinkedIn", handle: "alex-hormozi", url: "https://linkedin.com/in/alex-hormozi", icon: "LinkedIn" },
              { platform: "YouTube", handle: "Alex Hormozi", url: "https://youtube.com/@AlexHormozi", icon: "YouTube" },
              { platform: "Instagram", handle: "@hormozi", url: "https://instagram.com/hormozi", icon: "Instagram" }
            ]
          },
          {
            name: "Gary Vaynerchuk",
            desc: "Entrepreneur, CEO of VaynerMedia, and social media expert",
            socialLinks: [
              { platform: "X", handle: "@garyvee", url: "https://x.com/garyvee", icon: "X" },
              { platform: "LinkedIn", handle: "garyvaynerchuk", url: "https://linkedin.com/in/garyvaynerchuk", icon: "LinkedIn" },
              { platform: "YouTube", handle: "GaryVee", url: "https://youtube.com/@GaryVee", icon: "YouTube" },
              { platform: "Instagram", handle: "@garyvee", url: "https://instagram.com/garyvee", icon: "Instagram" }
            ]
          },
          {
            name: "Naval Ravikant",
            desc: "Entrepreneur, investor, and philosopher",
            socialLinks: [
              { platform: "X", handle: "@naval", url: "https://x.com/naval", icon: "X" },
              { platform: "LinkedIn", handle: "naval-ravikant", url: "https://linkedin.com/in/naval-ravikant", icon: "LinkedIn" },
              { platform: "YouTube", handle: "Naval Ravikant", url: "https://youtube.com/@naval", icon: "YouTube" }
            ]
          },
          {
            name: "Paul Graham",
            desc: "Co-founder of Y Combinator, essayist",
            socialLinks: [
              { platform: "X", handle: "@paulg", url: "https://x.com/paulg", icon: "X" },
              { platform: "Website", handle: "paulgraham.com", url: "https://paulgraham.com", icon: "Website" },
              { platform: "GitHub", handle: "@paulg", url: "https://github.com/paulg", icon: "GitHub" }
            ]
          },
          {
            name: "Reid Hoffman",
            desc: "Co-founder of LinkedIn, entrepreneur and investor",
            socialLinks: [
              { platform: "X", handle: "@reidhoffman", url: "https://x.com/reidhoffman", icon: "X" },
              { platform: "LinkedIn", handle: "reidhoffman", url: "https://linkedin.com/in/reidhoffman", icon: "LinkedIn" },
              { platform: "Website", handle: "reidhoffman.org", url: "https://reidhoffman.org", icon: "Website" }
            ]
          }
          ]
        };
      }

      // Image fetching has been removed - resources are now text-only

      return NextResponse.json({ 
        query: query,
        ...resources,
        usage: completion.usage 
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // Fallback response for API errors
      const fallbackResources = {
        books: [
          { title: `$100M Offers`, desc: `How to make offers so good people feel stupid saying no`, url: `https://amazon.com/dp/1737475715`, author: "Alex Hormozi" },
          { title: `Zero to One`, desc: `Notes on startups, or how to build the future`, url: `https://amazon.com/dp/0804139296`, author: "Peter Thiel" },
          { title: `Atomic Habits`, desc: `Build good habits and break bad ones`, url: `https://amazon.com/dp/0735211299`, author: "James Clear" },
          { title: `Deep Work`, desc: `Rules for focused success in a distracted world`, url: `https://amazon.com/dp/1455586692`, author: "Cal Newport" },
          { title: `The Lean Startup`, desc: `How today's entrepreneurs use continuous innovation`, url: `https://amazon.com/dp/0307887898`, author: "Eric Ries" }
        ],
    podcasts: [
      { title: `Founders`, desc: `Biographies of the world's greatest entrepreneurs by David Senra`, url: `https://podcasts.apple.com/podcast/id1151430296`, spotifyUrl: `https://open.spotify.com/search/Founders%20David%20Senra` },
      { title: `The Tim Ferriss Show`, desc: `Interviews with world-class performers`, url: `https://podcasts.apple.com/podcast/id863897795`, spotifyUrl: `https://open.spotify.com/search/The%20Tim%20Ferriss%20Show` },
      { title: `How I Built This`, desc: `Stories behind successful companies`, url: `https://podcasts.apple.com/podcast/id1154105909`, spotifyUrl: `https://open.spotify.com/search/How%20I%20Built%20This` },
      { title: `The GaryVee Audio Experience`, desc: `Business insights and motivational content`, url: `https://podcasts.apple.com/podcast/id928159684`, spotifyUrl: `https://open.spotify.com/search/The%20GaryVee%20Audio%20Experience` },
      { title: `Masters of Scale`, desc: `How great companies grow from zero to a gazillion`, url: `https://podcasts.apple.com/podcast/id1227971746`, spotifyUrl: `https://open.spotify.com/search/Masters%20of%20Scale` }
    ],
        social: [
          { 
            name: "Naval Ravikant", 
            desc: "Entrepreneur, investor, and philosopher", 
            socialLinks: [
              { platform: "X", handle: "@naval", url: "https://x.com/naval", icon: "X" },
              { platform: "LinkedIn", handle: "naval-ravikant", url: "https://linkedin.com/in/naval-ravikant", icon: "LinkedIn" },
              { platform: "YouTube", handle: "Naval Ravikant", url: "https://youtube.com/@naval", icon: "YouTube" }
            ]
          },
          { 
            name: "Paul Graham", 
            desc: "Co-founder of Y Combinator, essayist", 
            socialLinks: [
              { platform: "X", handle: "@paulg", url: "https://x.com/paulg", icon: "X" },
              { platform: "Website", handle: "paulgraham.com", url: "https://paulgraham.com", icon: "Website" },
              { platform: "GitHub", handle: "@paulg", url: "https://github.com/paulg", icon: "GitHub" }
            ]
          }
        ]
      };

      return NextResponse.json({ 
        query: query,
        ...fallbackResources,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
    }

  } catch (error) {
    console.error('General API error:', error);
    
    // Provide a helpful fallback even for general errors
    const fallbackResources = {
      books: [
        { title: `Atomic Habits`, desc: `Build good habits and break bad ones`, url: `https://amazon.com/dp/0735211299`, author: "James Clear" },
        { title: `Deep Work`, desc: `Rules for focused success in a distracted world`, url: `https://amazon.com/dp/1455586692`, author: "Cal Newport" },
        { title: `The Lean Startup`, desc: `How today's entrepreneurs use continuous innovation`, url: `https://amazon.com/dp/0307887898`, author: "Eric Ries" }
      ],
      podcasts: [
        { title: `The Tim Ferriss Show`, desc: `Interviews with world-class performers`, url: `https://podcasts.apple.com/podcast/id863897795`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
        { title: `How I Built This`, desc: `Stories behind successful companies`, url: `https://podcasts.apple.com/podcast/id1154105909`, spotifyUrl: `https://open.spotify.com/show/6E6sTsI8O5j1dpEYFqylx8` }
      ],
        social: [
          { 
            name: "Naval Ravikant", 
            desc: "Entrepreneur, investor, and philosopher", 
            socialLinks: [
              { platform: "X", handle: "@naval", url: "https://x.com/naval", icon: "X" },
              { platform: "LinkedIn", handle: "naval-ravikant", url: "https://linkedin.com/in/naval-ravikant", icon: "LinkedIn" },
              { platform: "YouTube", handle: "Naval Ravikant", url: "https://youtube.com/@naval", icon: "YouTube" }
            ]
          },
          { 
            name: "Paul Graham", 
            desc: "Co-founder of Y Combinator, essayist", 
            socialLinks: [
              { platform: "X", handle: "@paulg", url: "https://x.com/paulg", icon: "X" },
              { platform: "Website", handle: "paulgraham.com", url: "https://paulgraham.com", icon: "Website" },
              { platform: "GitHub", handle: "@paulg", url: "https://github.com/paulg", icon: "GitHub" }
            ]
          }
        ]
    };

    return NextResponse.json({ 
      query: query || 'Your Topic',
      ...fallbackResources,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }
}
