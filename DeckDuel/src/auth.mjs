import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({ region: "us-east-1" });
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID;

export const handler = async (event) => {
  const { action, email, password, username, code, session } = JSON.parse(event.body);

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

    // ---- LOGIN ----
    if (action === "login") {
      const result = await client.send(new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }));

      // If MFA is required, return the session so frontend can prompt for TOTP code
      if (result.ChallengeName === "SOFTWARE_TOKEN_MFA") {
        return respond(200, {
          challenge: "MFA_REQUIRED",
          session: result.Session,
        });
      }

      // Login successful - return tokens
      return respond(200, {
        message: "Login successful!",
        tokens: {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
        },
      });
    }

    // ---- VERIFY MFA CODE ----
    if (action === "verifyMfa") {
      const result = await client.send(new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          SOFTWARE_TOKEN_MFA_CODE: code,
        },
      }));

      return respond(200, {
        message: "MFA verified!",
        tokens: {
          accessToken: result.AuthenticationResult.AccessToken,
          idToken: result.AuthenticationResult.IdToken,
          refreshToken: result.AuthenticationResult.RefreshToken,
        },
      });
    }
    // ---- CONFIRM SIGNUP ----
    if (action === "confirmSignup") {
    const { ConfirmSignUpCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    await client.send(new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
    }));
    return respond(200, { message: "Email verified! You can now sign in." });
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