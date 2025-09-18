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
            { title: `${query} Twitter`, desc: `Best accounts and communities`, url: `https://example.com/${query.replace(/\s+/g, '-').toLowerCase()}-twitter` },
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
    content: `You are a helpful AI assistant that finds high-quality resources for learning topics. When given a topic like "${query}", you should recommend:

1. **Books** - EXACTLY 5 specific, well-known books with real titles and authors
2. **People** - EXACTLY 5 influential people in the field with their social media links
3. **Podcasts** - EXACTLY 5 specific podcast shows or episodes

IMPORTANT: You MUST provide exactly 5 items for each category. No more, no less.

SPECIAL INSTRUCTIONS FOR ENTREPRENEURS:
- If the query mentions "entrepreneurship", "entrepreneurs", or specific entrepreneur names like "Alex Hormozi", prioritize well-known entrepreneurs
- For Alex Hormozi specifically, include his real social media profiles and books
- Always include the most prominent, recognizable people in the field
- Focus on people who are actively sharing content and have significant social media presence
- Ensure you provide 5 different people, 5 different books, and 5 different podcasts

For each resource, provide:
- A realistic, specific title
- A brief, helpful description
- A REAL, working URL that users can actually visit
- An author field for books (this helps with cover image lookup)

IMPORTANT: Use real URLs that work:
- For books: Use Amazon, Goodreads, or publisher URLs
- For podcasts: Provide BOTH Apple Podcasts AND Spotify URLs when possible
- For people: Include their real social media profiles (Twitter, LinkedIn, YouTube, etc.)

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
        {"platform": "Twitter", "handle": "@username", "url": "https://twitter.com/username", "icon": "🐦"},
        {"platform": "LinkedIn", "handle": "person-name", "url": "https://linkedin.com/in/person-name", "icon": "💼"},
        {"platform": "YouTube", "handle": "Channel Name", "url": "https://youtube.com/@channel", "icon": "📺"}
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
              name: "Alex Hormozi", 
              desc: "Serial entrepreneur, gym owner, and business educator", 
              socialLinks: [
                { platform: "Twitter", handle: "@AlexHormozi", url: "https://twitter.com/AlexHormozi", icon: "🐦" },
                { platform: "LinkedIn", handle: "alex-hormozi", url: "https://linkedin.com/in/alex-hormozi", icon: "💼" },
                { platform: "YouTube", handle: "Alex Hormozi", url: "https://youtube.com/@AlexHormozi", icon: "📺" },
                { platform: "Instagram", handle: "@AlexHormozi", url: "https://instagram.com/alexhormozi", icon: "📸" }
              ]
            },
            { 
              name: "Gary Vaynerchuk", 
              desc: "Entrepreneur, CEO of VaynerMedia, and social media expert", 
              socialLinks: [
                { platform: "Twitter", handle: "@garyvee", url: "https://twitter.com/garyvee", icon: "🐦" },
                { platform: "LinkedIn", handle: "garyvaynerchuk", url: "https://linkedin.com/in/garyvaynerchuk", icon: "💼" },
                { platform: "YouTube", handle: "GaryVee", url: "https://youtube.com/@GaryVee", icon: "📺" },
                { platform: "Instagram", handle: "@garyvee", url: "https://instagram.com/garyvee", icon: "📸" }
              ]
            },
            { 
              name: "Naval Ravikant", 
              desc: "Entrepreneur, investor, and philosopher", 
              socialLinks: [
                { platform: "Twitter", handle: "@naval", url: "https://twitter.com/naval", icon: "🐦" },
                { platform: "LinkedIn", handle: "naval-ravikant", url: "https://linkedin.com/in/naval-ravikant", icon: "💼" },
                { platform: "YouTube", handle: "Naval Ravikant", url: "https://youtube.com/@naval", icon: "📺" }
              ]
            },
            { 
              name: "Paul Graham", 
              desc: "Co-founder of Y Combinator, essayist", 
              socialLinks: [
                { platform: "Twitter", handle: "@paulg", url: "https://twitter.com/paulg", icon: "🐦" },
                { platform: "Website", handle: "paulgraham.com", url: "https://paulgraham.com", icon: "🌐" },
                { platform: "GitHub", handle: "@paulg", url: "https://github.com/paulg", icon: "💻" }
              ]
            },
            { 
              name: "Reid Hoffman", 
              desc: "Co-founder of LinkedIn, entrepreneur and investor", 
              socialLinks: [
                { platform: "Twitter", handle: "@reidhoffman", url: "https://twitter.com/reidhoffman", icon: "🐦" },
                { platform: "LinkedIn", handle: "reidhoffman", url: "https://linkedin.com/in/reidhoffman", icon: "💼" },
                { platform: "Website", handle: "reidhoffman.org", url: "https://reidhoffman.org", icon: "🌐" }
              ]
            }
          ]
        };
      }

      // Fetch real cover images for each resource
      const fetchCoverImage = async (resource, type) => {
        try {
          const coverResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/cover-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: resource.title,
              type: type,
              author: resource.author
            })
          });
          
          if (coverResponse.ok) {
            const coverData = await coverResponse.json();
            return coverData.imageUrl;
          }
        } catch (error) {
          console.log(`Failed to fetch cover for ${resource.title}:`, error.message);
        }
        return null;
      };

      // Add thumbnails to all resources
      if (resources.books) {
        for (const book of resources.books) {
          book.thumbnail = await fetchCoverImage(book, 'book');
        }
      }
      
      if (resources.podcasts) {
        for (const podcast of resources.podcasts) {
          podcast.thumbnail = await fetchCoverImage(podcast, 'podcast');
        }
      }
      
      if (resources.social) {
        for (const social of resources.social) {
          social.thumbnail = await fetchCoverImage(social, 'social');
        }
      }

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
          { title: `$100M Leads`, desc: `How to get strangers to want to buy your stuff`, url: `https://amazon.com/dp/1737475723`, author: "Alex Hormozi" },
          { title: `Atomic Habits`, desc: `Build good habits and break bad ones`, url: `https://amazon.com/dp/0735211299`, author: "James Clear" },
          { title: `Deep Work`, desc: `Rules for focused success in a distracted world`, url: `https://amazon.com/dp/1455586692`, author: "Cal Newport" },
          { title: `The Lean Startup`, desc: `How today's entrepreneurs use continuous innovation`, url: `https://amazon.com/dp/0307887898`, author: "Eric Ries" }
        ],
        podcasts: [
          { title: `The Tim Ferriss Show`, desc: `Interviews with world-class performers`, url: `https://podcasts.apple.com/podcast/id863897795`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
          { title: `How I Built This`, desc: `Stories behind successful companies`, url: `https://podcasts.apple.com/podcast/id1154105909`, spotifyUrl: `https://open.spotify.com/show/6E6sTsI8O5j1dpEYFqylx8` },
          { title: `The GaryVee Audio Experience`, desc: `Business insights and motivational content`, url: `https://podcasts.apple.com/podcast/id928159684`, spotifyUrl: `https://open.spotify.com/show/1fMUGyV3eLqF4Lk7HdYp6h` },
          { title: `Masters of Scale`, desc: `How great companies grow from zero to a gazillion`, url: `https://podcasts.apple.com/podcast/id1227971746`, spotifyUrl: `https://open.spotify.com/show/1FcXiMTJ9QrQx3fQ4s8w8i` },
          { title: `The Smart Passive Income Podcast`, desc: `Online business strategies and passive income`, url: `https://podcasts.apple.com/podcast/id383275001`, spotifyUrl: `https://open.spotify.com/show/2fQn6l6p6Fcj8vJO3vbyZ7` }
        ],
        social: [
          { 
            name: "Naval Ravikant", 
            desc: "Entrepreneur, investor, and philosopher", 
            socialLinks: [
              { platform: "Twitter", handle: "@naval", url: "https://twitter.com/naval", icon: "🐦" },
              { platform: "LinkedIn", handle: "naval-ravikant", url: "https://linkedin.com/in/naval-ravikant", icon: "💼" },
              { platform: "YouTube", handle: "Naval Ravikant", url: "https://youtube.com/@naval", icon: "📺" }
            ]
          },
          { 
            name: "Paul Graham", 
            desc: "Co-founder of Y Combinator, essayist", 
            socialLinks: [
              { platform: "Twitter", handle: "@paulg", url: "https://twitter.com/paulg", icon: "🐦" },
              { platform: "Website", handle: "paulgraham.com", url: "https://paulgraham.com", icon: "🌐" },
              { platform: "GitHub", handle: "@paulg", url: "https://github.com/paulg", icon: "💻" }
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
              { platform: "Twitter", handle: "@naval", url: "https://twitter.com/naval", icon: "🐦" },
              { platform: "LinkedIn", handle: "naval-ravikant", url: "https://linkedin.com/in/naval-ravikant", icon: "💼" },
              { platform: "YouTube", handle: "Naval Ravikant", url: "https://youtube.com/@naval", icon: "📺" }
            ]
          },
          { 
            name: "Paul Graham", 
            desc: "Co-founder of Y Combinator, essayist", 
            socialLinks: [
              { platform: "Twitter", handle: "@paulg", url: "https://twitter.com/paulg", icon: "🐦" },
              { platform: "Website", handle: "paulgraham.com", url: "https://paulgraham.com", icon: "🌐" },
              { platform: "GitHub", handle: "@paulg", url: "https://github.com/paulg", icon: "💻" }
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
