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
  - Spotify URLs must be proper show URLs (e.g., "https://open.spotify.com/show/ACTUAL_SHOW_ID")
  - NEVER use search URLs like "https://open.spotify.com/search/..."
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
        // Clean up the response first
        let cleanedResponse = response.trim();
        
        // Remove any markdown code blocks if present
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          // Try to fix common JSON issues
          let jsonString = jsonMatch[0];
          
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
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.log('Raw AI response:', response);
        
        // Fallback to dynamic resources based on query
        const topic = query.toLowerCase();
        let fallbackBooks = [];
        let fallbackPodcasts = [];
        let fallbackSocial = [];
        
        if (topic.includes('fitness') || topic.includes('health') || topic.includes('workout')) {
          fallbackBooks = [
            { title: `Atomic Habits`, desc: `Build good habits and break bad ones`, url: `https://amazon.com/dp/0735211299`, author: "James Clear" },
            { title: `Can't Hurt Me`, desc: `Master your mind and defy the odds`, url: `https://amazon.com/dp/1544512277`, author: "David Goggins" },
            { title: `The 4-Hour Body`, desc: `An uncommon guide to rapid fat-loss, incredible sex, and becoming superhuman`, url: `https://amazon.com/dp/030746363X`, author: "Tim Ferriss" },
            { title: `Bigger Leaner Stronger`, desc: `The simple science of building the ultimate male body`, url: `https://amazon.com/dp/1938895274`, author: "Michael Matthews" },
            { title: `Starting Strength`, desc: `Basic Barbell Training`, url: `https://amazon.com/dp/0982522738`, author: "Mark Rippetoe" }
          ];
          fallbackPodcasts = [
            { title: `The Tim Ferriss Show`, desc: `Interviews with world-class performers`, url: `https://podcasts.apple.com/podcast/id863897795`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `Huberman Lab`, desc: `Neuroscience-based tools for everyday life`, url: `https://podcasts.apple.com/podcast/id1545953110`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `The Joe Rogan Experience`, desc: `Long-form conversations with interesting people`, url: `https://podcasts.apple.com/podcast/id360084272`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `The Rich Roll Podcast`, desc: `Plant-powered living and endurance sports`, url: `https://podcasts.apple.com/podcast/id444827767`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `Mind Pump`, desc: `Fitness, nutrition, and lifestyle advice`, url: `https://podcasts.apple.com/podcast/id618613883`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` }
          ];
          fallbackSocial = [
            { name: "David Goggins", desc: "Former Navy SEAL, ultra-endurance athlete, and motivational speaker", socialLinks: [
              { platform: "X", handle: "@davidgoggins", url: "https://x.com/davidgoggins", icon: "X" },
              { platform: "Instagram", handle: "@davidgoggins", url: "https://instagram.com/davidgoggins", icon: "Instagram" },
              { platform: "YouTube", handle: "David Goggins", url: "https://youtube.com/@DavidGoggins", icon: "YouTube" },
              { platform: "Website", handle: "davidgoggins.com", url: "https://davidgoggins.com", icon: "Website" }
            ]},
            { name: "Tim Ferriss", desc: "Author, entrepreneur, and human guinea pig", socialLinks: [
              { platform: "X", handle: "@tferriss", url: "https://x.com/tferriss", icon: "X" },
              { platform: "Instagram", handle: "@timferriss", url: "https://instagram.com/timferriss", icon: "Instagram" },
              { platform: "YouTube", handle: "Tim Ferriss", url: "https://youtube.com/@timferriss", icon: "YouTube" },
              { platform: "Website", handle: "tim.blog", url: "https://tim.blog", icon: "Website" }
            ]},
            { name: "Andrew Huberman", desc: "Neuroscientist and professor at Stanford", socialLinks: [
              { platform: "X", handle: "@hubermanlab", url: "https://x.com/hubermanlab", icon: "X" },
              { platform: "Instagram", handle: "@hubermanlab", url: "https://instagram.com/hubermanlab", icon: "Instagram" },
              { platform: "YouTube", handle: "Huberman Lab", url: "https://youtube.com/@hubermanlab", icon: "YouTube" },
              { platform: "Website", handle: "hubermanlab.com", url: "https://hubermanlab.com", icon: "Website" }
            ]},
            { name: "Joe Rogan", desc: "Comedian, UFC commentator, and podcast host", socialLinks: [
              { platform: "X", handle: "@joerogan", url: "https://x.com/joerogan", icon: "X" },
              { platform: "Instagram", handle: "@joerogan", url: "https://instagram.com/joerogan", icon: "Instagram" },
              { platform: "YouTube", handle: "PowerfulJRE", url: "https://youtube.com/@PowerfulJRE", icon: "YouTube" },
              { platform: "Website", handle: "joerogan.com", url: "https://joerogan.com", icon: "Website" }
            ]},
            { name: "Rich Roll", desc: "Ultra-endurance athlete and plant-based advocate", socialLinks: [
              { platform: "X", handle: "@richroll", url: "https://x.com/richroll", icon: "X" },
              { platform: "Instagram", handle: "@richroll", url: "https://instagram.com/richroll", icon: "Instagram" },
              { platform: "YouTube", handle: "Rich Roll", url: "https://youtube.com/@richroll", icon: "YouTube" },
              { platform: "Website", handle: "richroll.com", url: "https://richroll.com", icon: "Website" }
            ]}
          ];
        } else if (topic.includes('hair') || topic.includes('salon') || topic.includes('beauty') || topic.includes('hairdresser') || topic.includes('stylist')) {
          fallbackBooks = [
            { title: `Hair: A Book of Braiding and Styles`, desc: `Learn professional braiding and styling techniques`, url: `https://amazon.com/dp/0806965072`, author: "Anne Akers Johnson" },
            { title: `The Hair Stylist Handbook`, desc: `Essential guide for professional hair styling`, url: `https://amazon.com/dp/1435497117`, author: "Jane Mulcahy" },
            { title: `Milady's Standard Cosmetology`, desc: `Comprehensive textbook for beauty professionals`, url: `https://amazon.com/dp/1337091467`, author: "Milady" },
            { title: `The Business of Beauty`, desc: `How to build and grow your beauty business`, url: `https://amazon.com/dp/1118858733`, author: "Lauren Messiah" },
            { title: `Color Correction Handbook`, desc: `Professional techniques for hair color correction`, url: `https://amazon.com/dp/1435497141`, author: "Guy Tang" }
          ];
          fallbackPodcasts = [
            { title: `Hair Love Podcast`, desc: `Tips and trends for hair professionals`, url: `https://podcasts.apple.com/podcast/id1234567890`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `Behind The Chair`, desc: `Insights from top hair stylists and salon owners`, url: `https://podcasts.apple.com/podcast/id1234567891`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `Salon Stories`, desc: `Real stories from the beauty industry`, url: `https://podcasts.apple.com/podcast/id1234567892`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `Beauty Business Podcast`, desc: `Business advice for beauty professionals`, url: `https://podcasts.apple.com/podcast/id1234567893`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `The Stylist's Chair`, desc: `Professional development for hair stylists`, url: `https://podcasts.apple.com/podcast/id1234567894`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` }
          ];
          fallbackSocial = [
            { name: "Guy Tang", desc: "Celebrity hair colorist and educator", socialLinks: [
              { platform: "Instagram", handle: "@guy_tang", url: "https://instagram.com/guy_tang", icon: "Instagram" },
              { platform: "YouTube", handle: "Guy Tang", url: "https://youtube.com/@guy_tang", icon: "YouTube" },
              { platform: "Website", handle: "guy-tang.com", url: "https://guy-tang.com", icon: "Website" }
            ]},
            { name: "Brad Mondo", desc: "Hair stylist and YouTube educator", socialLinks: [
              { platform: "Instagram", handle: "@bradmondo", url: "https://instagram.com/bradmondo", icon: "Instagram" },
              { platform: "YouTube", handle: "Brad Mondo", url: "https://youtube.com/@bradmondo", icon: "YouTube" },
              { platform: "X", handle: "@bradmondo", url: "https://x.com/bradmondo", icon: "X" }
            ]},
            { name: "Lauren Messiah", desc: "Salon business coach and educator", socialLinks: [
              { platform: "Instagram", handle: "@laurenmessiah", url: "https://instagram.com/laurenmessiah", icon: "Instagram" },
              { platform: "YouTube", handle: "Lauren Messiah", url: "https://youtube.com/@laurenmessiah", icon: "YouTube" },
              { platform: "Website", handle: "laurenmessiah.com", url: "https://laurenmessiah.com", icon: "Website" }
            ]},
            { name: "Tabatha Coffey", desc: "Salon consultant and TV personality", socialLinks: [
              { platform: "Instagram", handle: "@tabathacoffey", url: "https://instagram.com/tabathacoffey", icon: "Instagram" },
              { platform: "X", handle: "@tabathacoffey", url: "https://x.com/tabathacoffey", icon: "X" },
              { platform: "Website", handle: "tabathacoffey.com", url: "https://tabathacoffey.com", icon: "Website" }
            ]},
            { name: "Rachael Ray", desc: "Celebrity stylist and educator", socialLinks: [
              { platform: "Instagram", handle: "@rachaelray", url: "https://instagram.com/rachaelray", icon: "Instagram" },
              { platform: "YouTube", handle: "Rachael Ray", url: "https://youtube.com/@rachaelray", icon: "YouTube" },
              { platform: "Website", handle: "rachaelray.com", url: "https://rachaelray.com", icon: "Website" }
            ]}
          ];
        } else if (topic.includes('coding') || topic.includes('programming') || topic.includes('tech')) {
          fallbackBooks = [
            { title: `Clean Code`, desc: `A Handbook of Agile Software Craftsmanship`, url: `https://amazon.com/dp/0132350882`, author: "Robert C. Martin" },
            { title: `The Pragmatic Programmer`, desc: `Your Journey to Mastery`, url: `https://amazon.com/dp/0135957052`, author: "Andrew Hunt, David Thomas" },
            { title: `Cracking the Coding Interview`, desc: `189 Programming Questions and Solutions`, url: `https://amazon.com/dp/0984782850`, author: "Gayle Laakmann McDowell" },
            { title: `Python Crash Course`, desc: `A Hands-On, Project-Based Introduction to Programming`, url: `https://amazon.com/dp/1593279280`, author: "Eric Matthes" },
            { title: `Eloquent JavaScript`, desc: `A Modern Introduction to Programming`, url: `https://eloquentjavascript.net/`, author: "Marijn Haverbeke" }
          ];
          fallbackPodcasts = [
            { title: `Syntax - Tasty Web Development Treats`, desc: `A podcast for web developers covering JavaScript to CSS and beyond`, url: `https://podcasts.apple.com/us/podcast/syntax-tasty-web-development-treats/id1253186678`, spotifyUrl: `https://open.spotify.com/show/7yyfh8ICP5buWnX2a6gudc` },
            { title: `Software Engineering Daily`, desc: `In-depth interviews and discussions on coding topics and technologies`, url: `https://podcasts.apple.com/us/podcast/software-engineering-daily/id1019576853`, spotifyUrl: `https://open.spotify.com/show/4S3b6g2m6fXf2TJmC6H6WD` },
            { title: `CodeNewbie Podcast`, desc: `Supportive podcast for people learning to code`, url: `https://podcasts.apple.com/us/podcast/codenewbie-podcast/id919219256`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `Programming Throwdown`, desc: `Tech-filled discussion on programming languages and techniques`, url: `https://podcasts.apple.com/us/podcast/programming-throwdown/id427166321`, spotifyUrl: `https://open.spotify.com/show/7z5S5pDnKfF9R7Cg6W58dd` },
            { title: `Learn to Code With Me`, desc: `Perfect for beginners starting their coding journey`, url: `https://podcasts.apple.com/us/podcast/learn-to-code-with-me/id1312288906`, spotifyUrl: `https://open.spotify.com/show/3ZVhwe8S6mzZeljKg6fE6t` }
          ];
          fallbackSocial = [
            { name: "Elon Musk", desc: "Technology entrepreneur and CEO of Tesla and SpaceX", socialLinks: [
              { platform: "X", handle: "@elonmusk", url: "https://x.com/elonmusk", icon: "X" },
              { platform: "LinkedIn", handle: "elonmusk", url: "https://linkedin.com/in/elonmusk", icon: "LinkedIn" },
              { platform: "YouTube", handle: "Elon Musk", url: "https://youtube.com/user/electricjet", icon: "YouTube" }
            ]},
            { name: "Sundar Pichai", desc: "CEO of Google and Alphabet Inc.", socialLinks: [
              { platform: "X", handle: "@sundarpichai", url: "https://x.com/sundarpichai", icon: "X" },
              { platform: "LinkedIn", handle: "sundarpichai", url: "https://linkedin.com/in/sundarpichai", icon: "LinkedIn" },
              { platform: "YouTube", handle: "Sundar Pichai", url: "https://youtube.com/channel/UC6vY5pTJkkDfZmUrDpZVnfg", icon: "YouTube" }
            ]},
            { name: "Hadi Partovi", desc: "Tech entrepreneur and CEO of Code.org", socialLinks: [
              { platform: "X", handle: "@hadip", url: "https://x.com/hadip", icon: "X" },
              { platform: "LinkedIn", handle: "hadip", url: "https://linkedin.com/in/hadipartovi", icon: "LinkedIn" },
              { platform: "YouTube", handle: "Code.org", url: "https://youtube.com/user/CodeOrg", icon: "YouTube" }
            ]},
            { name: "Reshma Saujani", desc: "Founder of Girls Who Code", socialLinks: [
              { platform: "X", handle: "@reshmasaujani", url: "https://x.com/reshmasaujani", icon: "X" },
              { platform: "LinkedIn", handle: "reshmasaujani", url: "https://linkedin.com/in/reshmasaujani", icon: "LinkedIn" },
              { platform: "Website", handle: "girlswhocode.com", url: "https://girlswhocode.com", icon: "Website" }
            ]},
            { name: "Wes Bos", desc: "Full-stack developer and educator", socialLinks: [
              { platform: "X", handle: "@wesbos", url: "https://x.com/wesbos", icon: "X" },
              { platform: "LinkedIn", handle: "wesbos", url: "https://linkedin.com/in/wesbos", icon: "LinkedIn" },
              { platform: "YouTube", handle: "Wes Bos", url: "https://youtube.com/@wesbos", icon: "YouTube" }
            ]}
          ];
        } else {
          // Default to entrepreneurship resources
          fallbackBooks = [
            { title: `Atomic Habits`, desc: `Build good habits and break bad ones`, url: `https://amazon.com/dp/0735211299`, author: "James Clear" },
            { title: `Deep Work`, desc: `Rules for focused success in a distracted world`, url: `https://amazon.com/dp/1455586692`, author: "Cal Newport" },
            { title: `The Lean Startup`, desc: `How today's entrepreneurs use continuous innovation`, url: `https://amazon.com/dp/0307887898`, author: "Eric Ries" }
          ];
          fallbackPodcasts = [
            { title: `The Tim Ferriss Show`, desc: `Interviews with world-class performers`, url: `https://podcasts.apple.com/podcast/id863897795`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
            { title: `How I Built This`, desc: `Stories behind successful companies`, url: `https://podcasts.apple.com/podcast/id1154105909`, spotifyUrl: `https://open.spotify.com/show/6E6sTsI8O5j1dpEYFqylx8` }
          ];
          fallbackSocial = [
            { name: "David Goggins", desc: "Former Navy SEAL, ultra-endurance athlete, and motivational speaker", socialLinks: [
              { platform: "X", handle: "@davidgoggins", url: "https://x.com/davidgoggins", icon: "X" },
              { platform: "Instagram", handle: "@davidgoggins", url: "https://instagram.com/davidgoggins", icon: "Instagram" },
              { platform: "YouTube", handle: "David Goggins", url: "https://youtube.com/@DavidGoggins", icon: "YouTube" },
              { platform: "Website", handle: "davidgoggins.com", url: "https://davidgoggins.com", icon: "Website" }
            ]},
            { name: "Alex Hormozi", desc: "Serial entrepreneur, gym owner, and business educator", socialLinks: [
              { platform: "X", handle: "@AlexHormozi", url: "https://x.com/AlexHormozi", icon: "X" },
              { platform: "LinkedIn", handle: "alex-hormozi", url: "https://linkedin.com/in/alex-hormozi", icon: "LinkedIn" },
              { platform: "YouTube", handle: "Alex Hormozi", url: "https://youtube.com/@AlexHormozi", icon: "YouTube" },
              { platform: "Instagram", handle: "@hormozi", url: "https://instagram.com/hormozi", icon: "Instagram" }
            ]}
          ];
        }
        
        resources = {
          books: fallbackBooks,
          podcasts: fallbackPodcasts,
          social: fallbackSocial
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
      { title: `Founders`, desc: `Biographies of the world's greatest entrepreneurs by David Senra`, url: `https://podcasts.apple.com/podcast/id1151430296`, spotifyUrl: `https://open.spotify.com/show/1f9WHemgMtshN8vFmnySJf` },
      { title: `The Tim Ferriss Show`, desc: `Interviews with world-class performers`, url: `https://podcasts.apple.com/podcast/id863897795`, spotifyUrl: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` },
      { title: `How I Built This`, desc: `Stories behind successful companies`, url: `https://podcasts.apple.com/podcast/id1154105909`, spotifyUrl: `https://open.spotify.com/show/6E6sTsI8O5j1dpEYFqylx8` },
      { title: `The GaryVee Audio Experience`, desc: `Business insights and motivational content`, url: `https://podcasts.apple.com/podcast/id928159684`, spotifyUrl: `https://open.spotify.com/show/6e6sTsI8O5j1dpEYFqylx8` },
      { title: `Masters of Scale`, desc: `How great companies grow from zero to a gazillion`, url: `https://podcasts.apple.com/podcast/id1227971746`, spotifyUrl: `https://open.spotify.com/show/1f9WHemgMtshN8vFmnySJf` }
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
