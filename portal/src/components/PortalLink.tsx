import { Link, type LinkProps } from 'react-router-dom';
import { isFiberRoute } from '../utils/routes';
// Reload when crossing the Fiber isolation boundary, preserving wallet popup behavior.
export function PortalLink(props: LinkProps) {
 const path = typeof props.to === 'string' ? props.to : props.to.pathname ?? '/';
 if (isFiberRoute(path.split('#')[0]) !== isFiberRoute()) { const {to, ...rest}=props; return <a {...rest} href={typeof to==='string'?to:path}/>; }
 return <Link {...props}/>;
}
