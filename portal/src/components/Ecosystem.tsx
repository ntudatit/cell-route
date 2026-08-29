import { ArrowUpRight, BookOpen, Braces, Code2, Droplets } from "lucide-react";

const links = [
 { title: "CCC Docs", text: "Learn CCC concepts and wallet integration", url: "https://docs.ckbccc.com/", icon: <BookOpen/> },
 { title: "CCC Playground", text: "Experiment with live examples", url: "https://docs.ckbccc.com/docs/playground", icon: <Code2/> },
 { title: "CCC API", text: "Browse the API reference", url: "https://api.ckbccc.com/", icon: <Braces/> },
 { title: "Testnet Faucet", text: "Get Testnet CKB for development", url: "https://faucet.nervos.org/", icon: <Droplets/> },
];

export function Ecosystem() {
 return (
  <section className="panel ecosystem" id="developer">
   <h3>Developer resources</h3><p>Official resources for learning and testing CKB applications.</p>
   <div className="eco-grid">{links.map((item) => <a key={item.title} href={item.url} target="_blank" rel="noreferrer"><span className="eco-icon">{item.icon}</span><b>{item.title}</b><span>{item.text}</span><ArrowUpRight/></a>)}</div>
  </section>
 );
}