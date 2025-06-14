import ThoughtCard from './ThoughtCard';
import styled from 'styled-components';
import { colors } from '../styles/colors';

const List = styled.ul`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  padding: 0;
  list-style: none;
`;

const ListItem = styled.li`
  width: 100%;
  max-width: 500px;
  margin: 0;
  padding: 0;
`;

const EmptyState = styled.div`
  text-align: center;
  color: ${colors.text.secondary};
  padding: 20px;
`;

/**
 * Renders a list of thought cards (no pagination controls)
 */
const ThoughtList = ({ 
  thoughts, 
  onLike, 
  currentUser, 
  onUpdate, 
  onDelete,
  loading
}) => {
  return (
    <List role="list">
      {thoughts.length === 0 ? (
        <EmptyState>No thoughts yet. Be the first to share!</EmptyState>
      ) : (
        thoughts.map((thought) => (
          <ListItem key={thought._id} role="listitem">
            <ThoughtCard
              _id={thought._id}
              message={thought.message}
              createdAt={thought.createdAt}
              hearts={thought.hearts}
              likesCount={thought.likesCount}
              owner={thought.owner}
              onLike={onLike}
              liked={thought.isLikedByUser}
              currentUser={currentUser}
              onUpdate={onUpdate}
              onDelete={onDelete}
              isOptimistic={thought.isOptimistic}
            />
          </ListItem>
        ))
      )}
    </List>
  );
};

export default ThoughtList; 