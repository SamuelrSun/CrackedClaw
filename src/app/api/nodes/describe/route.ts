import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganization } from "@/lib/supabase/data";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get("nodeId");

    if (!nodeId) {
      return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
    }

    const organization = await getOrganization(user.id);
    if (!organization?.openclaw_gateway_url || !organization?.openclaw_auth_token) {
      return NextResponse.json({ error: "No gateway configured" }, { status: 400 });
    }

    // Fetch node description from the gateway
    const res = await fetch(`${organization.openclaw_gateway_url}/api/nodes/describe?node=${nodeId}`, {
      headers: {
        "Authorization": `Bearer ${organization.openclaw_auth_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("Failed to fetch node description:", await res.text());
      return NextResponse.json({ 
        capabilities: {
          camera: false,
          screen: false,
          location: false,
          notifications: false,
          exec: false,
          browser: false,
        }
      });
    }

    const data = await res.json();
    
    // Transform capabilities to boolean map
    const capList = data.capabilities || [];
    const capabilities = {
      camera: capList.includes("camera") || capList.includes("camera_snap"),
      screen: capList.includes("screen") || capList.includes("screen_record"),
      location: capList.includes("location") || capList.includes("location_get"),
      notifications: capList.includes("notifications") || capList.includes("notify"),
      exec: capList.includes("exec") || capList.includes("run"),
      browser: capList.includes("browser"),
    };

    return NextResponse.json({ capabilities });
  } catch (err) {
    console.error("Error fetching node description:", err);
    return NextResponse.json({ 
      capabilities: {
        camera: false,
        screen: false,
        location: false,
        notifications: false,
        exec: false,
        browser: false,
      }
    });
  }
}
