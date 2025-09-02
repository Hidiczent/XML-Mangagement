// SignInForm.tsx
import React from "react";
import useTitle from "@/hooks/useTitle";


const SignInForm: React.FC = () => {
  useTitle("Sign In");

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#505991] font-laos">
      <div className="bg-[#FFFFFF] rounded-2xl shadow-lg p-8 w-[320px]">
        <h2 className="text-center text-xl font-bold text-[#505991] mb-6">
          Sign in Form
        </h2>

        {/* Email Field */}
        <label className="text-sm font-semibold text-[#505991]">E-Mail</label>
        <input
          type="email"
          className="w-full rounded-xl px-3 py-2 mt-1 mb-4 bg-[#505991] text-white placeholder-white outline-none"
          placeholder="Enter your email"
        />

        {/* Password Field */}
        <label className="text-sm font-semibold text-[#505991]">Password</label>
        <input
          type="password"
          className="w-full rounded-xl px-3 py-2 mt-1 mb-3 bg-[#505991] text-white placeholder-white outline-none"
          placeholder="Enter your password"
        />

        {/* Remember me & Forgot Password */}
        <div className="flex items-center justify-between mb-5">
          <label className="flex items-center gap-2 text-xs text-[#505991]">
            <input type="checkbox" className="accent-[#505991]" />
            remember me
          </label>
          <a href="#" className="text-xs text-[#FF1D21]">
            Forgot Password?
          </a>
        </div>

        {/* Log in button */}
        <button className="w-full py-2 rounded-full bg-[#505991] text-[#FFFFFF] font-semibold hover:opacity-90">
          Log in
        </button>

        
      </div>
    </div>
  );
};

export default SignInForm;
