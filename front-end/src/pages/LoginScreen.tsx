import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User, Phone } from "lucide-react";
import NeonButton from "@/components/NeonButton";
import heroBg from "@/assets/hero-bg.jpg";
import { facebook, google, login, signup, AuthResponse } from "@/api/auth";
import { toast } from "@/components/ui/sonner";
import { setAuthTokens } from "@/lib/auth-storage";
import ButtonLoadingScreen from "@/components/ui/buttonLoadingScreen";
import { getErrorToast } from "@/lib/page-utils";
import { useGoogleLogin } from "@react-oauth/google";

const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;
const FACEBOOK_GRAPH_VERSION = import.meta.env.VITE_FACEBOOK_GRAPH_VERSION || "v25.0";

const loadFacebookSdk = async() =>
  new Promise<void>((resolve, reject) => {
    if (!FACEBOOK_APP_ID) {
      reject(new Error("Facebook app id is missing. Add VITE_FACEBOOK_APP_ID to front-end/.env."));
      return;
    }

    if (window.FB) {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: FACEBOOK_GRAPH_VERSION,
      });
      resolve();
      return;
    }

    window.fbAsyncInit = () => {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: FACEBOOK_GRAPH_VERSION,
      });
      resolve();
    };

    const existingScript = document.getElementById("facebook-jssdk");
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => reject(new Error("Could not load Facebook login."));
    document.body.appendChild(script);
  });

const LoginScreen = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [username, setUsername] = useState("");
  const [phone_number, setPhone_number] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "facebook" | null>(null);
  const navigate = useNavigate();

  const completeLogin = (res: AuthResponse) => {
    setAuthTokens({
      accessToken: res.data.accessToken,
      refreshToken: res?.data.refreshToken,
    });
    toast.success(res.message);
    navigate("/");
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setSocialLoading("google");
        const res = await google(tokenResponse);
        completeLogin(res);
      } catch (err) {
        const errorToast = getErrorToast(err, { action: "Google login", fallback: "Google login failed." });
        toast.error(errorToast.title, { description: errorToast.description });
      } finally {
        setSocialLoading(null);
      }
    },
    onError: () => {
      toast.error("Google login failed.");
    },
    scope: "openid email profile",
  });

  const handleFacebookLogin = async () => {
    try {
      setSocialLoading("facebook");
      await loadFacebookSdk();

      window.FB.login(
        async (response) => {
          if (!response.authResponse?.accessToken) {
            setSocialLoading(null);
            toast.error("Facebook login was cancelled.");
            return;
          }

          try {
            const res = await facebook(response.authResponse);
            completeLogin(res);
          } catch (err) {
            const errorToast = getErrorToast(err, { action: "Facebook login", fallback: "Facebook login failed." });
            toast.error(errorToast.title, { description: errorToast.description });
          } finally {
            setSocialLoading(null);
          }
        },
        { scope: "public_profile,email", return_scopes: true },
      );
    } catch (err) {
      setSocialLoading(null);
      const errorToast = getErrorToast(err, { action: "Facebook login", fallback: "Facebook login failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone_number.trim() || !password) {
      toast.error("Phone number and password are required.");
      return;
    }

    if (isSignup && (!username.trim() || !email.trim())) {
      toast.error("Username and email are required.");
      return;
    }

    try {
      setLoading(true);
      const res = isSignup
        ? await signup({
          email: email.trim(),
          password,
          username: username.trim(),
          phone_number: phone_number.trim(),
        })
        : await login({ phone_number: phone_number.trim(), password });
      completeLogin(res);
    }
    catch (err) {
      const errorToast = getErrorToast(err, { action: isSignup ? "Signup" : "Login", fallback: "Authentication failed." });
      toast.error(errorToast.title, { description: errorToast.description });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-end">
      <img
        src={heroBg}
        alt="eSports arena"
        className="absolute inset-0 w-full h-full object-cover"
        width={768}
        height={1024}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto w-full max-w-md px-5 sm:px-6 pb-10 pt-8"
      >
        <h1 className="font-display text-3xl font-bold tracking-wider neon-text-purple mb-1">
          BATTLEARENA
        </h1>
        <p className="text-muted-foreground font-heading text-sm mb-8">
          {isSignup ? "Create your warrior account" : "Enter the arena"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <>
              <div className="glass rounded-lg flex items-center gap-3 px-4 py-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="bg-transparent flex-1 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div className="glass rounded-lg flex items-center gap-3 px-4 py-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="bg-transparent flex-1 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </>
          )}
          <div className="glass rounded-lg flex items-center gap-3 px-4 py-3">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <input
              type="tel"
              placeholder="Phone no."
              value={phone_number}
              onChange={(e) => setPhone_number(e.target.value)}
              disabled={loading}
              className="bg-transparent flex-1 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="glass rounded-lg flex items-center gap-3 px-4 py-3">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <input
              type={showPass ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="bg-transparent flex-1 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button type="button" onClick={() => setShowPass(!showPass)} disabled={loading}>
              {showPass ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {!isSignup && (
            <button type="button" className="text-xs text-primary font-heading">
              Forgot Password?
            </button>
          )}

          <NeonButton type="submit" full disabled={loading}>
            {loading ? <ButtonLoadingScreen /> : isSignup ? "SIGN UP" : "LOGIN"}
          </NeonButton>
        </form>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-heading">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={()=>handleGoogleLogin()}
            disabled={loading || Boolean(socialLoading)}
            type="button"
            className="flex-1 glass rounded-lg py-3 flex items-center justify-center gap-2 text-sm font-heading text-foreground"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {socialLoading === "google" ? <ButtonLoadingScreen /> : "Google"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleFacebookLogin}
            disabled={loading || Boolean(socialLoading)}
            type="button"
            className="flex-1 glass rounded-lg py-3 flex items-center justify-center gap-2 text-sm font-heading text-foreground"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            {socialLoading === "facebook" ? <ButtonLoadingScreen /> : "Facebook"}
          </motion.button>
        </div>

        <p className="text-center text-xs text-muted-foreground font-heading mt-6">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <button
            onClick={() => setIsSignup(!isSignup)}
            disabled={loading}
            className="text-primary font-semibold"
          >
            {isSignup ? "Login" : "Sign Up"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
