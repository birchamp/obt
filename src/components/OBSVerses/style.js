import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles((theme) => ({
  circular: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: theme.spacing(3),
  },
  sup: {
    marginRight: theme.spacing(1 / 2),
  },
  highlight: {
    backgroundColor: '#fff59d',
    color: theme.palette.text.primary,
    padding: '2px 0',
    borderRadius: '2px',
  },
}));

export default useStyles;
