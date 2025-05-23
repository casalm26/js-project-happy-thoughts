import styled from 'styled-components';

const ErrorWrapper = styled.div`
  color: #ff4444;
  margin: 20px 0;
  font-size: 1rem;
`;

const ErrorMessage = ({ children }) => <ErrorWrapper>{children}</ErrorWrapper>;

export default ErrorMessage; 