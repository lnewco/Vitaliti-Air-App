import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../config/supabase';

class WhoopAuthService {
  constructor() {
    this.baseUrl = 'https://api.prod.whoop.com';
    this.authUrl = 'https://api.prod.whoop.com/oauth/oauth2';
    this.clientId = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID || 'ef01edf8-b61c-4cac-99a0-d0825098dace';
    this.clientSecret = process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET || '1529284de2cde1574018824932aeec53222eee78487bd3ea63f87ae44d716aeb';
    
    // Get the proper redirect URI from Expo
    this.redirectUri = AuthSession.makeRedirectUri({
      scheme: 'vitalitiair',
      path: 'whoop-callback'
    });
    
    console.log('🔧 Whoop Auth Service initialized');
    console.log('🔗 Redirect URI:', this.redirectUri);
  }

  // Create auth request
  async createAuthRequest() {
    const request = new AuthSession.AuthRequest({
      clientId: this.clientId,
      scopes: ['read:body_measurement', 'read:workout', 'offline', 'read:cycles', 'read:recovery', 'read:sleep', 'read:profile'],
      responseType: AuthSession.ResponseType.Code,
      redirectUri: this.redirectUri,
      codeChallenge: await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Crypto.getRandomBytes(43).toString(),
        { encoding: Crypto.CryptoEncoding.BASE64URL }
      ),
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    });

    return request;
  }

  // Initiate OAuth flow
  async authenticate(userId) {
    try {
      console.log('🔄 Starting Whoop authentication...');
      
      // Use the EXACT redirect URI that's registered with Whoop
      // This must match what's in your Whoop app settings
      const redirectUri = 'https://auth.expo.io/@anonymous/Vitaliti-Air-App/whoop-callback';
      
      console.log('📱 Using redirect URI:', redirectUri);
      
      // Build the authorization URL
      const authorizationEndpoint = `${this.authUrl}/auth`;
      const request = new AuthSession.AuthRequest({
        clientId: this.clientId,
        scopes: ['read:body_measurement', 'read:workout', 'offline', 'read:cycles', 'read:recovery', 'read:sleep', 'read:profile'],
        responseType: AuthSession.ResponseType.Code,
        redirectUri: redirectUri,
        state: userId,
        extraParams: {
          // Add any extra params Whoop might need
        }
      });

      // Prompt the user to authorize
      const result = await request.promptAsync({
        authorizationEndpoint,
        useProxy: true // Use Expo's proxy service
      });

      console.log('Auth result type:', result.type);
      
      if (result.type === 'success') {
        console.log('✅ Authorization successful, exchanging code for tokens...');
        const tokens = await this.exchangeCodeForTokens(result.params.code, redirectUri, userId);
        return { success: true, tokens };
      } else if (result.type === 'cancel') {
        console.log('❌ User cancelled authorization');
        return { success: false, error: 'User cancelled' };
      } else {
        console.log('❌ Authorization failed:', result);
        return { success: false, error: 'Authorization failed' };
      }
    } catch (error) {
      console.error('Whoop auth error:', error);
      return { success: false, error: error.message };
    }
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code, redirectUri, userId) {
    try {
      console.log('🔄 Exchanging code for tokens...');
      
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }).toString();
      
      const response = await fetch(`${this.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange failed:', errorText);
        throw new Error(`Failed to exchange code: ${response.status}`);
      }

      const tokens = await response.json();
      console.log('✅ Token exchange successful');
      
      // Save to database
      await this.saveIntegration(userId, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        vendor_user_id: tokens.user?.user_id || tokens.user_id || null
      });
      
      return tokens;
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  // Save integration to Supabase
  async saveIntegration(userId, tokenData) {
    const { data, error } = await supabase
      .from('customer_integrations')
      .upsert({
        user_id: userId,
        vendor: 'whoop',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        vendor_user_id: tokenData.vendor_user_id,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,vendor'
      });

    if (error) {
      console.error('Error saving Whoop integration:', error);
      throw error;
    }

    return data;
  }

  // Check if user has active integration
  async hasActiveIntegration(userId) {
    const { data, error } = await supabase
      .from('customer_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('vendor', 'whoop')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking Whoop integration:', error);
      return false;
    }

    if (!data) return false;

    // Check if token is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      console.log('Token expired, needs refresh');
      // You could auto-refresh here if needed
      return false;
    }

    return true;
  }

  // Disconnect integration
  async disconnect(userId) {
    const { error } = await supabase
      .from('customer_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('vendor', 'whoop');

    if (error) {
      console.error('Error disconnecting Whoop:', error);
      throw error;
    }

    return true;
  }
}

export default new WhoopAuthService();