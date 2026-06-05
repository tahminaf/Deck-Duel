import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({ region: "us-east-1" });
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID;
const USER_POOL_ID = process.env.USER_POOL_ID;

// Accepts an email or a preferred_username, always returns the Cognito email
const resolveEmail = async (identifier) => {
  if (identifier.includes('@')) return identifier;
  const result = await client.send(new ListUsersCommand({
    UserPoolId: USER_POOL_ID,
    Filter: `preferred_username = "${identifier}"`,
    Limit: 1,
  }));
  const user = result.Users?.[0];
  if (!user) return null;
  return user.Attributes?.find(a => a.Name === 'email')?.Value || null;
};

const getPreferredUsername = async (email) => {
  const record = await client.send(new AdminGetUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
  }));
  return record.UserAttributes?.find(a => a.Name === 'preferred_username')?.Value
    || email.split('@')[0];
};

export const handler = async (event) => {
  const { action, email, password, username, code, session, newPassword } = JSON.parse(event.body);

  try {
    // ---- SIGN UP ----
    if (action === "signup") {
      await client.send(new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "preferred_username", Value: username },
        ],
      }));
      return respond(201, { message: "Account created! Check your email to verify." });
    }

    // ---- RESEND VERIFICATION CODE ----
    if (action === "resendVerification") {
      await client.send(new ResendConfirmationCodeCommand({
        ClientId: CLIENT_ID,
        Username: email,
      }));
      return respond(200, { message: "Verification code resent." });
    }

    // ---- CONFIRM SIGNUP ----
    if (action === "confirmSignup") {
      await client.send(new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
      }));
      return respond(200, { message: "Email verified! You can now sign in." });
    }

    // ---- LOGIN ----
    if (action === "login") {
      const loginEmail = await resolveEmail(email);
      if (!loginEmail) return respond(400, { error: "No account found for that email or username." });

      const result = await client.send(new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: loginEmail, PASSWORD: password },
      }));

      if (result.ChallengeName === "SOFTWARE_TOKEN_MFA") {
        return respond(200, {
          challenge: "MFA_REQUIRED",
          session: result.Session,
          resolvedEmail: loginEmail,
        });
      }

      const preferredUsername = await getPreferredUsername(loginEmail);
      return respond(200, {
        message: "Login successful!",
        preferredUsername,
        tokens: {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
        },
      });
    }

    // ---- VERIFY MFA CODE ----
    if (action === "verifyMfa") {
      const loginEmail = await resolveEmail(email);
      if (!loginEmail) return respond(400, { error: "User not found." });

      const result = await client.send(new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: loginEmail, PASSWORD: password },
        Session: session,
        ChallengeResponses: {
          USERNAME: loginEmail,
          SOFTWARE_TOKEN_MFA_CODE: code,
        },
      }));

      const preferredUsername = await getPreferredUsername(loginEmail);
      return respond(200, {
        message: "MFA verified!",
        preferredUsername,
        tokens: {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
        },
      });
    }

    // ---- FORGOT PASSWORD ----
    if (action === "forgotPassword") {
      const loginEmail = await resolveEmail(email);
      if (!loginEmail) return respond(400, { error: "No account found for that email or username." });

      await client.send(new ForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: loginEmail,
      }));
      return respond(200, { message: "Reset code sent to your email.", resolvedEmail: loginEmail });
    }

    // ---- CONFIRM FORGOT PASSWORD ----
    if (action === "confirmForgotPassword") {
      const loginEmail = await resolveEmail(email);
      if (!loginEmail) return respond(400, { error: "User not found." });

      await client.send(new ConfirmForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: loginEmail,
        ConfirmationCode: code,
        Password: newPassword,
      }));
      return respond(200, { message: "Password reset successfully!" });
    }

    return respond(400, { error: "Invalid action" });

  } catch (err) {
    console.error(err);
    return respond(400, { error: err.message });
  }
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
  },
  body: JSON.stringify(body),
});
