import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_XigxjexeO',
      userPoolClientId: '7dnfhrla9c0qr90a48nbspk22',
    }
  }
});